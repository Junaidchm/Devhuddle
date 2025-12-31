import { publishEvent } from "../../utils/kafka.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import logger from "../../utils/logger.util";
import { IDLQRepository } from "../../repository/interface/IDlqRepository";

export interface DLQMessage {
  id: string;
  originalTopic: string;
  dlqTopic: string;
  eventData: Record<string, unknown>;
  errorMessage: string;
  dlqReason: string;
  retryCount: number;
  status: "PENDING" | "RETRYING" | "RESOLVED" | "FAILED";
  createdAt: Date;
  updatedAt: Date;
  resolution?: string;
}

export interface DLQQuery {
  status?: string;
  limit: number;
  offset: number;
  originalTopic?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface DLQStats {
  total: number;
  pending: number;
  retrying: number;
  resolved: number;
  failed: number;
  byTopic: Record<string, number>;
  recentFailures: number;
}

export class DLQService {
  constructor(private repo: IDLQRepository) {}

  async getDLQMessages(query: DLQQuery): Promise<{
    messages: DLQMessage[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const [messages, total] = await Promise.all([
        this.repo.findMany(query),
        this.repo.count(query),
      ]);
      return {
        messages: messages.map((msg) => ({
          id: msg.id,
          originalTopic: msg.originalTopic,
          dlqTopic: msg.dlqTopic,
          eventData: msg.eventData,
          errorMessage: msg.errorMessage,
          dlqReason: msg.dlqReason,
          retryCount: msg.retryCount,
          status: msg.status as DLQMessage["status"],
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          resolution: msg.resolution,
        })),
        total,
        hasMore: query.offset + query.limit < total,
      };
    } catch (error: unknown) {
      logger.error("Error fetching DLQ messages", {
        error: (error as Error).message,
        query,
      });
      throw error;
    }
  }

  async retryDLQMessage(
    dlqId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const dlqMessage = await this.repo.findById(dlqId);
      if (!dlqMessage) throw new Error("DLQ message not found");
      if (dlqMessage.status === "RESOLVED")
        throw new Error("DLQ message already processed");
      await this.repo.updateStatus(dlqId, {
        status: "RETRYING",
        retryCount: dlqMessage.retryCount + 1,
        updatedAt: new Date(),
      });
      const event = {
        ...dlqMessage.eventData,
        retryCount: dlqMessage.retryCount + 1,
        isRetry: true,
        originalDlqId: dlqId,
      };
      await publishEvent(dlqMessage.originalTopic, event);
      logger.info(`DLQ message retry initiated`, {
        dlqId,
        originalTopic: dlqMessage.originalTopic,
        retryCount: dlqMessage.retryCount + 1,
      });
      return {
        success: true,
        message: `Event republished to ${dlqMessage.originalTopic}`,
      };
    } catch (error: unknown) {
      logger.error("Error retrying DLQ message", {
        error: (error as Error).message,
        dlqId,
      });
      throw error;
    }
  }

  async resolveDLQMessage(dlqId: string, resolution: string): Promise<void> {
    try {
      const dlqMessage = await this.repo.findById(dlqId);
      if (!dlqMessage) throw new Error("DLQ message not found");
      await this.repo.updateStatus(dlqId, {
        status: "RESOLVED",
        resolution,
        updatedAt: new Date(),
      });
      logger.info(`DLQ message resolved`, { dlqId, resolution });
    } catch (error: unknown) {
      logger.error("Error resolving DLQ message", {
        error: (error as Error).message,
        dlqId,
      });
      throw error;
    }
  }

  async getDLQStats(): Promise<DLQStats> {
    try {
      const [
        total,
        pending,
        retrying,
        resolved,
        failed,
        byTopic,
        recentFailures,
      ] = await Promise.all([
        this.repo.count(),
        this.repo.count({ status: "PENDING", limit: 0, offset: 0 }),
        this.repo.count({ status: "RETRYING", limit: 0, offset: 0 }),
        this.repo.count({ status: "RESOLVED", limit: 0, offset: 0 }),
        this.repo.count({ status: "FAILED", limit: 0, offset: 0 }),
        this.repo.groupByTopic(),
        this.repo.countRecentFailures(),
      ]);
      const byTopicMap = byTopic.reduce((acc, item) => {
        acc[item.originalTopic] = item._count.id;
        return acc;
      }, {} as Record<string, number>);
      return {
        total,
        pending,
        retrying,
        resolved,
        failed,
        byTopic: byTopicMap,
        recentFailures,
      };
    } catch (error: unknown) {
      logger.error("Error fetching DLQ stats", { error: (error as Error).message });
      throw error;
    }
  }

  async cleanupOldMessages(daysOld: number = 30): Promise<number> {
    try {
      const deleted = await this.repo.deleteOldResolved(daysOld);
      logger.info(`Cleaned up ${deleted} old DLQ messages`);
      return deleted;
    } catch (error: unknown) {
      logger.error("Error cleaning up old DLQ messages", {
        error: (error as Error).message,
      });
      throw error;
    }
  }
}
