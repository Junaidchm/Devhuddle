import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'path';
import logger from '../utils/logger.util';
import { createCircuitBreaker } from '../utils/circuit.breaker.util';
import CircuitBreaker from 'opossum';

const PROTO_PATH = path.join(__dirname, '../../protos/admin.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const adminService = protoDescriptor.admin.AdminService;

export interface SubmitReportRequest {
  reporterId: string;
  targetId: string;
  targetType: string;
  reason: string;
  description?: string;
  metadata?: string;
}

export interface SubmitReportResponse {
  success: boolean;
  reportId: string;
  message: string;
}

export class AdminServiceClient {
  private _client: any;
  private _circuitBreaker: CircuitBreaker<[SubmitReportRequest], SubmitReportResponse>;
  private readonly _timeout = 3000;

  constructor() {
    const AUTH_SERVICE_GRPC_URL = process.env.AUTH_SERVICE_GRPC_URL || 'localhost:50051';

    this._client = new adminService(
      AUTH_SERVICE_GRPC_URL,
      grpc.credentials.createInsecure()
    );

    const protectedSubmitReport = async (request: SubmitReportRequest): Promise<SubmitReportResponse> => {
      return new Promise((resolve, reject) => {
        const deadline = new Date();
        deadline.setSeconds(deadline.getSeconds() + this._timeout / 1000);

        this._client.SubmitReport(
          request,
          { deadline },
          (error: grpc.ServiceError | null, response: SubmitReportResponse) => {
            if (error) {
              logger.error('gRPC SubmitReport error', {
                message: error.message,
                code: error.code,
              });
              return reject(error);
            }
            resolve(response);
          }
        );
      });
    };

    this._circuitBreaker = createCircuitBreaker(
      protectedSubmitReport,
      'AdminService.SubmitReport',
      {
        timeout: 5000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      }
    );

    this._circuitBreaker.fallback(() => {
      logger.error('AdminService.SubmitReport fallback triggered');
      return {
        success: false,
        reportId: '',
        message: 'Moderation service unavailable. Please try again later.',
      };
    });
  }

  async submitReport(request: SubmitReportRequest): Promise<SubmitReportResponse> {
    try {
      return await this._circuitBreaker.fire(request);
    } catch (error) {
      logger.error('Failed to submit report via gRPC', { error: (error as Error).message });
      return { success: false, reportId: '', message: 'Failed to submit report' };
    }
  }
}

export const adminServiceClient = new AdminServiceClient();
