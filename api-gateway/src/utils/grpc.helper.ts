import * as grpc from '@grpc/grpc-js';
import * as authProto from '../../grpc-generated/auth_pb';
import * as authService from '../../grpc-generated/auth_grpc_pb';
import { authClient } from '../config/grpc.client';

// Helper function to handle gRPC calls with proper typing
export const grpcCall = <T>(method: keyof authService.AuthServiceClient, requestData: any): Promise<T> => {
  console.log(`Initiating gRPC call to method: ${method}`);
  console.log('Request data:', requestData.toObject());
  return new Promise((resolve, reject) => {
    (authClient[method] as any)(requestData, (error: grpc.ServiceError | null, response: T) => {
      if (error) {
        console.error(`gRPC call to ${method} failed:`, error);
        reject(error);
      } else {
        console.log(`gRPC call to ${method} succeeded:`, response);
        resolve(response);
      }
    });
  });
};