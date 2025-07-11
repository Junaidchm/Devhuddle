import * as grpc from "@grpc/grpc-js";
import { AuthController } from "./controllers/auth.controller";
import { AuthService } from "./services/auth.service";
import { UserRepository } from "./repositories/user.repository";
import logger from "./utils/logger.util";
import { setAuthToken } from "./utils/jwtHandler";
import * as authProto from "../grpc-generated/auth_pb";
import { AuthServiceService } from "../grpc-generated/auth_grpc_pb";
import { UntypedServiceImplementation, ServiceDefinition } from "@grpc/grpc-js";
import { CustomError, sendErrorResponse } from "./utils/error.util";

// Initialize repositories, services, and controllers
const userRepository = new UserRepository();
const authServiceUser = new AuthService(userRepository);
const authController = new AuthController(authServiceUser);

// gRPC service implementation
const authServiceImpl: UntypedServiceImplementation = {
  register: async (
    call: grpc.ServerUnaryCall<
      authProto.RegisterRequest,
      authProto.RegisterResponse
    >,
    callback: grpc.sendUnaryData<authProto.RegisterResponse>
  ) => {
    try {
      logger.info("Received gRPC register request", {
        request: call.request.toObject(),
      });
      const response = await authController.register(call.request);
      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC register error", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode = err instanceof CustomError ? err.status : 500;
      callback({
        code:
          statusCode === 400
            ? grpc.status.INVALID_ARGUMENT
            : grpc.status.INTERNAL,
        message: err.message || "Server error",
      });
    }
  },
};

// Start gRPC server
const server = new grpc.Server();
server.addService(
  AuthServiceService as unknown as ServiceDefinition<UntypedServiceImplementation>,
  authServiceImpl
);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`gRPC server running on port ${GRPC_PORT}`);
  }
);

export default server;
