import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import logger from '../utils/logger.util';
import { createCircuitBreaker } from '../utils/circuit.breaker.util';
import CircuitBreaker from 'opossum';

const PROTO_PATH = path.join(__dirname, '../../protos/user.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const userService = protoDescriptor.UserService;

// gRPC Response Types (matches proto definition)
interface GrpcUserProfile {
  id: string;
  username: string;
  name: string;
  profilePhoto: string;
}

interface GrpcGetUserProfilesResponse {
  profiles: GrpcUserProfile[];
}

// Application Domain Types
export interface UserProfile {
  id: string;
  username: string;
  name: string;
  profilePhoto: string;
}

export class AuthServiceClient {
  private _client: any;
  private _circuitBreaker: CircuitBreaker<[string[]], Map<string, UserProfile>>;
  private readonly _maxRetries = 3;
  private readonly _timeout = 5000; // 5 seconds

  constructor() {
    const AUTH_SERVICE_GRPC_URL =
      process.env.AUTH_SERVICE_GRPC_URL || 'localhost:50051';

    logger.info('🔌 Connecting to Auth Service gRPC', { url: AUTH_SERVICE_GRPC_URL });

    this._client = new userService(
      AUTH_SERVICE_GRPC_URL,
      grpc.credentials.createInsecure()
    );

    // Wrap the gRPC call in a Circuit Breaker for fault tolerance
    const protectedCall = async (userIds: string[]): Promise<Map<string, UserProfile>> => {
      return new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + this._timeout / 1000);

        this._client.GetUserProfiles(
          { user_ids: userIds },
          { deadline },
          (error: grpc.ServiceError | null, response: GrpcGetUserProfilesResponse) => {
            if (error) {
              logger.error('gRPC getUserProfiles error', {
                message: error.message,
                code: error.code,
              });
              return reject(error);
            }

            const profilesMap = new Map<string, UserProfile>();
            response.profiles?.forEach((profile: GrpcUserProfile) => {
              profilesMap.set(profile.id, {
                id: profile.id,
                username: profile.username,
                name: profile.name,
                profilePhoto: profile.profilePhoto,
              });
            });

            logger.info(`✅ gRPC: Got ${profilesMap.size} user profiles`);
            resolve(profilesMap);
          }
        );
      });
    };

    // Create Circuit Breaker with fallback
    this._circuitBreaker = createCircuitBreaker(
      protectedCall,
      'AuthService.GetUserProfiles',
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      }
    );

    // Set fallback to return empty map (graceful degradation)
    this._circuitBreaker.fallback(() => {
      logger.warn('Using fallback: Returning empty user profiles (chat UI will show initials)');
      return new Map<string, UserProfile>();
    });
  }

  /**
   * Get user profiles for conversation enrichment
   * Returns a Map for O(1) lookups during conversation mapping
   * Protected by Circuit Breaker - returns empty map if auth-service is down
   */
  async getUserProfiles(userIds: string[]): Promise<Map<string, UserProfile>> {
    if (!userIds || userIds.length === 0) {
      logger.warn('getUserProfiles: No user IDs provided');
      return new Map();
    }

    logger.info('📊 Calling gRPC getUserProfiles (via Circuit Breaker)', {
      userCount: userIds.length,
    });

    try {
      // Fire through Circuit Breaker (handles retries, timeout, fallback)
      return await this._circuitBreaker.fire(userIds);
    } catch (error) {
      // Fallback already applied by Circuit Breaker
      logger.error('Circuit Breaker failed, using fallback', {
        error: (error as Error).message,
      });
      return new Map();
    }
  }

  /**
   * Health check for gRPC connection
   * Can be called on startup to verify connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to get profiles for a dummy user (will return empty, but tests connection)
      await this.getUserProfiles(['health-check']);
      logger.info('✅ Auth service gRPC health check passed');
      return true;
    } catch (error) {
      logger.error('❌ Auth service gRPC health check failed', { 
        error: (error as Error).message 
      });
      return false;
    }
  }
}

// Singleton instance
export const authServiceClient = new AuthServiceClient();
