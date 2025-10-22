import { object } from "zod";
import prisma from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import { NotificationObject, Prisma } from "@prisma/client";

export class NotificationsRepository
  extends BaseRepository<
    typeof prisma.notificationObject,
    NotificationObject,
    Prisma.NotificationObjectCreateInput,
    Prisma.NotificationObjectUpdateInput,
    Prisma.NotificationObjectWhereUniqueInput
  >
  implements INotificationRepository
{
  constructor() {
    super(prisma.notificationObject);
  }

  async createFollowNotification(
    issuerId: string,
    recipientId: string,
    version: number
  ): Promise<void> {
    try {
      const existingObject = await prisma.notificationObject.findFirst({
        where: {
          type: "FOLLOW",
          entityType: "USER",
        },
        include: { recipients: true },
      });

      if (existingObject) {
        await super.update(existingObject.id, {
          aggregatedCount: { increment: 1 },
          summary: {
            json: {
              actors: [
                ...((existingObject.summary as any)?.actors || []),
                issuerId,
              ],
              count: existingObject.aggregatedCount + 1,
            },
          },
          version,
        });

        await prisma.notificationActor.create({
          data: {
            notificationObjectId: existingObject.id,
            actorId: issuerId,
          },
        });
      } else {
        const notifObj = await prisma.notificationObject.create({
          data: {
            type: "FOLLOW",
            entityType: "USER",
            entityId: recipientId,
            summary: { toJSON: { actors: [issuerId], count: 1 } },
            version,
          },
        });

        await prisma.notificationActor.create({
          data: {
            notificationObjectId: notifObj.id,
            actorId: issuerId,
          },
        });

        await prisma.notificationRecipient.create({
          data: {
            notificationObjectId: notifObj.id,
            recipientId,
          },
        });
      }

      logger.info(`Follow notification processed for recipient ${recipientId}`);
    } catch (error: any) {
      logger.error("Error creating follow notification", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async deleteFollowNotification(
    issuerId: string,
    recipientId: string
  ): Promise<void> {
    try {
      const existing = await prisma.notificationObject.findFirst({
        where: { type: "FOLLOW", entityType: "USER", entityId: recipientId },
        include: { actors: true },
      });

      if (!existing) return;

      // delete the actor
      await prisma.notificationActor.deleteMany({
        where: { notificationObjectId: existing.id, actorId: issuerId },
      });

      const reminingActorsCount = await prisma.notificationActor.count({
        where: {
          notificationObjectId: existing.id,
        },
      });

      if (reminingActorsCount === 0) {
        await prisma.notificationRecipient.updateMany({
          where: {
            recipientId,
          },
          data: {
            deletedAt: new Date(),
          },
        });
      } else {
        await prisma.notificationObject.update({
          where: {
            id: existing.id,
          },
          data: {
            aggregatedCount: reminingActorsCount,
            summary: {
              toJSON: {
                actors: existing.actors
                  .filter((a) => a.actorId !== issuerId)
                  .map((a) => a.actorId),
              },
              count: reminingActorsCount,
            },
          },
        });

        logger.info(`Follow notification deleted for recipient ${recipientId}`);
      }
    } catch (error: any) {
      logger.error("Error deletting follow notification", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
