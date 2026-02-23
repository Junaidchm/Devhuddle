import * as grpc from "@grpc/grpc-js";
import {
  AdminServiceServer,
  SubmitReportRequest,
  SubmitReportResponse,
  GetUserStatusRequest,
  GetUserStatusResponse,
} from "../grpc/generated/admin";
import logger from "../utils/logger.util";
import { AdminRepository } from "../repositories/impliments/admin.repository";
import { AdminService } from "../services/impliments/admin.service";
import { ReportTargetType } from "@prisma/client";

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);

export const adminGrpcService: AdminServiceServer = {
  submitReport: async (
    call: grpc.ServerUnaryCall<SubmitReportRequest, SubmitReportResponse>,
    callback: grpc.sendUnaryData<SubmitReportResponse>
  ) => {
    try {
      const { reporterId, targetId, targetType, reason, description, metadata } = call.request;

      logger.info("gRPC SubmitReport called", { reporterId, targetId, targetType });

      const report = await adminService.createReport({
        reporterId,
        targetId,
        targetType: targetType as ReportTargetType,
        reason: reason as any,
        description,
        metadata: metadata ? JSON.parse(metadata) : undefined,
      });

      callback(null, {
        success: true,
        reportId: report.id,
        message: "Report submitted successfully",
      });
    } catch (err: any) {
      logger.error("gRPC SubmitReport error", {
        error: err.message,
        stack: err.stack,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: err.message || "Failed to submit report",
      });
    }
  },

  getUserStatus: async (
    call: grpc.ServerUnaryCall<GetUserStatusRequest, GetUserStatusResponse>,
    callback: grpc.sendUnaryData<GetUserStatusResponse>
  ) => {
    try {
      const { userId } = call.request;
      const user = await adminService.getUserFullDetails(userId);
      
      callback(null, {
        isBlocked: user?.isBlocked || false,
      });
    } catch (err: any) {
      logger.error("gRPC GetUserStatus error", {
        error: err.message,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: err.message || "Failed to get user status",
      });
    }
  },
};
