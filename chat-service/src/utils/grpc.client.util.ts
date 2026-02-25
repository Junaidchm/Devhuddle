import * as grpc from "@grpc/grpc-js";

/**
 * Promisify gRPC client calls
 */
export const grpcs = <TClient, TRequest, TResponse>(
  client: TClient,
  method: keyof TClient,
  request: TRequest
): Promise<TResponse> => {
  return new Promise((resolve, reject) => {
    const clientMethod = client[method] as unknown as (
      request: TRequest,
      callback: (error: grpc.ServiceError | null, response: TResponse) => void
    ) => void;

    if (typeof clientMethod !== "function") {
      return reject(new Error(`Method ${String(method)} not found on client`));
    }

    clientMethod.call(client, request, (error: grpc.ServiceError | null, response: TResponse) => {
      if (error) {
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
};
