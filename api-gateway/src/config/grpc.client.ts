import * as grpc from "@grpc/grpc-js";
import { AuthServiceClient } from "../grpc/generated/auth";

export const authClient = new AuthServiceClient(
  process.env.AUTH_GRPC_URL || "auth-service:50051",
  grpc.credentials.createInsecure(),
  { "grpc.keepalive_time_ms": 10000, "grpc.keepalive_timeout_ms": 5000 }
);

