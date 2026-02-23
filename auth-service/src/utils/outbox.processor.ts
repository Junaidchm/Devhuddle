import prisma from "../config/prisma.config";
import { publishEvent } from "./kafka.util";
import logger from "./logger.util";
import { OutboxStatus } from "@prisma/client";

export class OutboxProcessor {
  private static isRunning = false;
  private static interval: NodeJS.Timeout | null = null;

  static async start(pollingIntervalMs: number = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;

    logger.info("Starting Outbox Processor", { pollingIntervalMs });

    this.interval = setInterval(async () => {
      await this.processEvents();
    }, pollingIntervalMs);
  }

  static stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    logger.info("Outbox Processor stopped");
  }

  private static async processEvents() {
    try {
      const pendingEvents = await prisma.outboxEvent.findMany({
        where: {
          status: OutboxStatus.PENDING,
        },
        take: 10,
        orderBy: { createdAt: "asc" },
      });

      if (pendingEvents.length === 0) return;

      logger.info(`Processing ${pendingEvents.length} outbox events`);

      for (const event of pendingEvents) {
        try {
          // Update status to PROCESSING to prevent double-processing
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.PROCESSING, lastAttemptedAt: new Date() },
          });

          // Publish to Kafka
          await publishEvent(event.topic, event.payload, event.id);

          // Mark as COMPLETED
          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.COMPLETED, processedAt: new Date() },
          });
        } catch (error: any) {
          logger.error(`Failed to process outbox event ${event.id}`, {
            error: error.message,
            attempts: event.attempts + 1,
          });

          const nextStatus = event.attempts >= 5 ? OutboxStatus.FAILED : OutboxStatus.PENDING;

          await prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: nextStatus,
              attempts: { increment: 1 },
            },
          });
        }
      }
    } catch (error: any) {
      logger.error("Outbox Processor iteration failed", { error: error.message });
    }
  }
}
