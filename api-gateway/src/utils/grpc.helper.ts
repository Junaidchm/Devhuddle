import { authClient } from "../config/grpc.client";
import * as grpc from "@grpc/grpc-js"
import { AuthServiceClient } from "../grpc/generated/auth";
import { resolve } from "path";
import { logger } from "./logger";

/**
 * @param client - An instance of any gRPC service client
 * @param method - The name of the RPC method to call
 * @param requestData - The request object for the RPC method
 * @returns A Promise resolving with the RPC response
 */


export const grpcs =async<
Client,
RequestType,
ResponseType
>(client:Client,method : keyof Client, requestData:RequestType):Promise<ResponseType>=> {

  return new Promise((resolve,reject)=> {
    (client[method] as Function)(requestData, (error: grpc.ServiceError | null, response: ResponseType) => {
      if(error) {
        logger.error(`gRPC call to ${method as string} failed`, { error: error.message, stack: error.stack });
        reject(error)
      }
      else {
         logger.info(`gRPC call to ${method as string} succeeded`, { response });
         resolve(response)
      }
    })
  })
    
};

export const grpcCall = <T, U>(method: keyof AuthServiceClient, requestData: T): Promise<U> => {
  logger.info(`Initiating gRPC call to method: ${method}`, { request: requestData });
  return new Promise((resolve, reject) => {
    (authClient[method] as any)(requestData, (error: grpc.ServiceError | null, response: U) => {
      if (error) {
        logger.error(`gRPC call to ${method} failed`, { error: error.message, stack: error.stack });
        reject(error);
      } else {
        logger.info(`gRPC call to ${method} succeeded`, { response });
        resolve(response);
      }
    });
  });
};  