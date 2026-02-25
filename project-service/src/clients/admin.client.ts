import * as grpc from "@grpc/grpc-js";
import {
  AdminServiceClient as AdminClient,
  SubmitReportRequest,
  SubmitReportResponse,
  GetUserStatusResponse,
} from "../grpc/generated/admin";
import { grpcs } from "../utils/grpc.client.util";
import logger from "../utils/logger.util";

class AdminServiceClient {
  private _client: AdminClient;

  constructor() {
    const AUTH_SERVICE_URL = process.env.AUTH_GRPC_URL || process.env.AUTH_SERVICE_GRPC_URL || "auth-service:50051";
    this._client = new AdminClient(
      AUTH_SERVICE_URL,
      grpc.credentials.createInsecure()
    );
    logger.info("AdminServiceClient initialized", { url: AUTH_SERVICE_URL });
  }

  async submitReport(req: SubmitReportRequest): Promise<SubmitReportResponse> {
    try {
      return await grpcs<AdminClient, SubmitReportRequest, SubmitReportResponse>(
        this._client,
        "submitReport",
        req
      );
    } catch (err: any) {
      logger.error("AdminServiceClient.submitReport error", { error: err.message });
      throw err;
    }
  }

  async getUserStatus(userId: string): Promise<GetUserStatusResponse> {
    try {
      return await grpcs<AdminClient, { userId: string }, GetUserStatusResponse>(
        this._client,
        "getUserStatus",
        { userId }
      );
    } catch (err: any) {
      logger.error("AdminServiceClient.getUserStatus error", { error: err.message });
      throw err;
    }
  }
}

export const adminServiceClient = new AdminServiceClient();
