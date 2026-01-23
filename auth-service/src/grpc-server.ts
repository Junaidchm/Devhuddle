import * as grpc from "@grpc/grpc-js";

import { AuthServiceService } from "./grpc/generated/auth";
import { UserServiceService } from "./grpc/generated/user";

import logger from "./utils/logger.util";
import { userServic } from "./serviceDefinition/userService";
import { authService } from "./serviceDefinition/authService";

const server = new grpc.Server();
server.addService(AuthServiceService, authService);
server.addService(UserServiceService, userServic);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`✅ gRPC server running on port ${GRPC_PORT}`);
  }
);

export default server;
