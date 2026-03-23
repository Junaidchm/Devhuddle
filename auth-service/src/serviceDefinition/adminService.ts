import * as grpc from "@grpc/grpc-js";
import {
  AdminServiceServer,
  SubmitReportRequest,
  SubmitReportResponse,
  GetUserStatusRequest,
  GetUserStatusResponse,
  CreateAuditLogRequest,
  CreateAuditLogResponse,
  GetDashboardUserStatsRequest,
  GetDashboardUserStatsResponse,
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

      logger.info("gRPC SubmitReport called", { 
        reporterId, 
        targetId, 
        targetType,
        reason
      });

      const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
      
      const report = await adminService.createReport({
        reporterId,
        targetId,
        targetType: targetType as ReportTargetType,
        reason: reason as any,
        description,
        metadata: parsedMetadata,
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
  createAuditLog: async (
    call: grpc.ServerUnaryCall<CreateAuditLogRequest, CreateAuditLogResponse>,
    callback: grpc.sendUnaryData<CreateAuditLogResponse>
  ) => {
    try {
      const { adminId, action, targetType, targetId, reason, metadata } = call.request;

      logger.info("gRPC CreateAuditLog called", { 
        adminId, 
        action, 
        targetType,
        targetId
      });

      const parsedMetadata = metadata ? JSON.parse(metadata) : undefined;
      
      await adminRepository.createAuditLog({
        admin: { connect: { id: adminId } },
        action,
        targetType,
        targetId,
        reason,
        metadata: parsedMetadata,
      });

      callback(null, {
        success: true,
        logId: "", // Prisma doesn't return ID easily in this context without awaiting create, but we can just say success
        message: "Audit log created successfully",
      });
    } catch (err: any) {
      logger.error("gRPC CreateAuditLog error", {
        error: err.message,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: err.message || "Failed to create audit log",
      });
    }
  },
  getDashboardUserStats: async (
    call: grpc.ServerUnaryCall<GetDashboardUserStatsRequest, GetDashboardUserStatsResponse>,
    callback: grpc.sendUnaryData<GetDashboardUserStatsResponse>
  ) => {
    try {
      const stats = await adminService.getDashboardStats();
      callback(null, {
        totalUsers: stats.users.total,
        activeUsers: stats.users.active,
        blockedUsers: stats.users.blocked,
        newUsersToday: stats.users.newToday,
        newUsersThisWeek: stats.users.newThisWeek,
        newUsersThisMonth: stats.users.newThisMonth,
      });
    } catch (err: any) {
      logger.error("gRPC GetDashboardUserStats error", {
        error: err.message,
      });
      callback({
        code: grpc.status.INTERNAL,
        message: err.message || "Failed to get dashboard user stats",
      });
    }
  },
};
