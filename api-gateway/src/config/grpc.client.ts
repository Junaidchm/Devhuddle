import * as grpc from '@grpc/grpc-js';
import * as authProto from '../../grpc-generated/auth_pb';
import * as authService from '../../grpc-generated/auth_grpc_pb';

// gRPC client
export const authClient = new authService.AuthServiceClient(
  process.env.AUTH_GRPC_URL || 'auth-service:50051',
  grpc.credentials.createInsecure(),
  { 'grpc.keepalive_time_ms': 10000, 'grpc.keepalive_timeout_ms': 5000 }
);