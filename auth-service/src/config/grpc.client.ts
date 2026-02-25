import * as grpc from "@grpc/grpc-js";
import { PostServiceClient } from "../grpc/generated/post";
import { ProjectServiceClient } from "../grpc/generated/project";
import { AdminServiceClient as ChatAdminServiceClient } from "../grpc/generated/chat-admin";
import dotenv from "dotenv";

dotenv.config();

const createClient = <T extends typeof grpc.Client>(
  ClientClass: T,
  url: string
): InstanceType<T> => {
  return new ClientClass(
    url,
    grpc.credentials.createInsecure()
  ) as InstanceType<T>;
};

export const postClient = createClient(
  PostServiceClient,
  process.env.POST_SERVICE_GRPC_URL || "localhost:50051"
);

export const projectClient = createClient(
  ProjectServiceClient,
  process.env.PROJECT_SERVICE_GRPC_URL || "localhost:50053"
);

export const chatClient = createClient(
  ChatAdminServiceClient,
  process.env.CHAT_SERVICE_GRPC_URL || "localhost:50054"
);
