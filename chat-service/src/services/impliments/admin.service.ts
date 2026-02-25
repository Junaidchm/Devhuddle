import { IAdminService, GetHubsParams, AdminHub } from "../interfaces/IAdminService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Conversation, Prisma } from "@prisma/client";
import { AppError } from "../../utils/AppError";
import logger from "../../utils/logger.util";
import { adminAuthClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.util";

export class AdminService implements IAdminService {
  constructor(private readonly _chatRepository: IChatRepository) {}

  async getHubs(params: GetHubsParams): Promise<{ hubs: AdminHub[]; total: number }> {
    try {
      const { page, limit, search, status } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ConversationWhereInput = {
        type: 'GROUP',
        deletedAt: null
      };

      if (status && status !== "all") {
        if (status === "suspended") {
          where.isSuspended = true;
        } else if (status === "active") {
          where.isSuspended = false;
        } else if (status === "reported") {
          where.reports = { some: {} };
        }
      }

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [hubsWithCounts, total] = await Promise.all([
        this._chatRepository.findHubsWithReportCount(where, limit, skip),
        this._chatRepository.getConversationCount(where),
      ]);

      const hubs: AdminHub[] = hubsWithCounts.map((hub) => ({
        ...hub,
        reportsCount: hub._count.reports,
      }));

      return { hubs, total };
    } catch (error: unknown) {
      logger.error("AdminService.getHubs Error", { error });
      throw error;
    }
  }

  async getReportedHubs(params: { page: number; limit: number; search?: string }): Promise<{ hubs: AdminHub[]; total: number }> {
    try {
      const { page, limit, search } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ConversationWhereInput = {
        type: 'GROUP',
        deletedAt: null,
        reports: {
            some: {}
        }
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }
      
      const [hubsWithCounts, total] = await Promise.all([
        this._chatRepository.findHubsWithReportCount(where, limit, skip),
        this._chatRepository.getConversationCount(where),
      ]);

      const hubs: AdminHub[] = hubsWithCounts.map((hub) => ({
        ...hub,
        reportsCount: hub._count.reports,
      }));

      return { hubs, total };
    } catch (error: unknown) {
      logger.error("AdminService.getReportedHubs Error", { error });
      throw error;
    }
  }

  async getHubById(hubId: string): Promise<AdminHub> {
    try {
      const hub = await this._chatRepository.findHubByIdWithReportCount(hubId);
      if (!hub || hub.type !== "GROUP" || hub.deletedAt) {
        throw new AppError("Hub not found", 404);
      }

      return {
        ...hub,
        reportsCount: hub._count.reports,
      };
    } catch (error: unknown) {
      logger.error("AdminService.getHubById Error", { error });
      throw error;
    }
  }

  async suspendHub(hubId: string, suspend: boolean, reason?: string, adminId?: string): Promise<Conversation> {
    try {
      // Fetch hub first to get ownerId
      const hub = await this._chatRepository.findHubByIdWithReportCount(hubId);
      
      const result = await this._chatRepository.updateConversation(hubId, {
          isSuspended: suspend,
          suspendedAt: suspend ? new Date() : null
      });

      // Emit Kafka notification to hub owner
      if (hub?.ownerId) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: hubId,
          targetType: "HUB",
          ownerId: hub.ownerId,
          action: suspend ? "HIDE" : "UNHIDE",
          reason: reason || (suspend ? "Hub suspended by admin" : "Hub restored by admin"),
          adminId: adminId || "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: adminId || "system",
            action: suspend ? "HUB_SUSPENDED" : "HUB_RESTORED",
            targetType: "HUB",
            targetId: hubId,
            reason: reason || (suspend ? "Hub suspended by admin" : "Hub restored by admin"),
            metadata: JSON.stringify({ ownerId: hub.ownerId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for hub suspend/restore", { error: auditError });
        }
      }

      return result;
    } catch (error: unknown) {
      logger.error("AdminService.suspendHub Error", { error });
      throw error;
    }
  }

  async deleteHub(hubId: string, adminId?: string): Promise<void> {
    try {
      // Fetch hub first to get ownerId
      const hub = await this._chatRepository.findHubByIdWithReportCount(hubId);
      
      await this._chatRepository.updateConversation(hubId, {
          deletedAt: new Date()
      });

      // Emit Kafka notification to hub owner
      if (hub?.ownerId) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: hubId,
          targetType: "HUB",
          ownerId: hub.ownerId,
          action: "DELETE",
          reason: "Hub permanently removed by admin",
          adminId: adminId || "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });
      }
    } catch (error: unknown) {
      logger.error("AdminService.deleteHub Error", { error });
      throw error;
    }
  }

  async getHubStats(): Promise<{ totalHubs: number; reportedHubs: number; suspendedHubs: number; deletedHubs: number }> {
    try {
      const [total, reported, suspended, deleted] = await Promise.all([
        this._chatRepository.getConversationCount({ type: "GROUP", deletedAt: null }),
        this._chatRepository.getConversationCount({ type: "GROUP", reports: { some: {} }, deletedAt: null }),
        this._chatRepository.getConversationCount({ type: "GROUP", isSuspended: true, deletedAt: null }),
        this._chatRepository.getConversationCount({ type: "GROUP", deletedAt: { not: null } }),
      ]);

      return {
        totalHubs: total,
        reportedHubs: reported,
        suspendedHubs: suspended,
        deletedHubs: deleted,
      };
    } catch (error: unknown) {
      logger.error("AdminService.getHubStats Error", { error });
      throw error;
    }
  }
}
