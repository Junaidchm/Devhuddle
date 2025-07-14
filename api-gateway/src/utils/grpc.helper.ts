import { authClient } from "../config/grpc.client";
import * as grpc from "@grpc/grpc-js"
import { AuthServiceClient } from "grpc/generated/auth";
import { resolve } from "path";
import { logger } from "./logger";


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