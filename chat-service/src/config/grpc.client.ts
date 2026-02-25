import * as grpc from "@grpc/grpc-js";
import { AdminServiceClient } from "../grpc/generated/admin";

export const adminAuthClient = new AdminServiceClient(
  process.env.AUTH_GRPC_URL || "auth-service:50051",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);
