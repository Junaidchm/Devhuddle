import * as grpc from "@grpc/grpc-js";
import { PostServicServer, PostServicService } from "./grpc/generated/post";
import logger from "./utils/logger.util";

const postService: PostServicServer = {
  createPost: async (call, c) => {},
};

const server = new grpc.Server();
server.addService(PostServicService, postService);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`✅ gRPC server running on port ${GRPC_PORT}`);
  }
);

export default server;
