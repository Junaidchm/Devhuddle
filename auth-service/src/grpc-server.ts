import * as grpc from "@grpc/grpc-js";

import { AuthServiceService } from "./grpc/generated/auth";
import { UserServiceService } from "./grpc/generated/user";
import { AdminServiceService } from "./grpc/generated/admin";

import logger from "./utils/logger.util";
import { userService } from "./serviceDefinition/userService";
import { authService } from "./serviceDefinition/authService";
import { adminGrpcService } from "./serviceDefinition/adminService";

const server = new grpc.Server();
server.addService(AuthServiceService, authService);
server.addService(UserServiceService, userService);
server.addService(AdminServiceService, adminGrpcService);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) {
      logger.error(`gRPC server failed to bind: ${err.message}`);
      return;
    }
    logger.info(`✅ gRPC server running on port ${port}`);
    server.start();
  }
);

export default server;
