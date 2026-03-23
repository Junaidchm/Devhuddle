import * as grpc from "@grpc/grpc-js";
import {UserServiceClient} from "../grpc/generated/user"
import {AdminServiceClient as AuthAdminClient} from "../grpc/generated/admin"
import {ProjectServiceClient} from "../grpc/generated/project"
import {ChatStatsServiceClient} from "../grpc/generated/chat-stats"

export const userClient = new UserServiceClient(
  process.env.AUTH_GRPC_URL || "auth-service:50051",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);

export const adminAuthClient = new AuthAdminClient(
  process.env.AUTH_GRPC_URL || "auth-service:50051",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);

export const projectClient = new ProjectServiceClient(
  process.env.PROJECT_GRPC_URL || "project-service:50053",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);

export const adminChatClient = new ChatStatsServiceClient(
  process.env.CHAT_GRPC_URL || "chat-service:50055",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);
