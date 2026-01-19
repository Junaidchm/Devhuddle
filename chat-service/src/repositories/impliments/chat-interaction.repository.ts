import { IChatInteractionRepository } from "../interfaces/IChatInteractionRepository";
import { BaseRepository } from "./base.repository";
import prisma from "../../config/db";
import logger from "../../utils/logger.util";
import { ChatInteraction, Prisma } from "@prisma/client";

export class ChatInteractionRepository
    extends BaseRepository<
        typeof prisma.chatInteraction,
        ChatInteraction,
        Prisma.ChatInteractionCreateInput,
        Prisma.ChatInteractionUpdateInput,
        Prisma.ChatInteractionWhereUniqueInput
    >
    implements IChatInteractionRepository {
    constructor() {
        super(prisma.chatInteraction);
    }

    /**
     * Find chat interactions for a user with specific partners
     */
    async findByUserAndPartners(
        userId: string,
        partnerIds: string[],
        sinceDate: Date
    ): Promise<ChatInteraction[]> {
        try {
            return await this.model.findMany({
                where: {
                    userId,
                    partnerId: {
                        in: partnerIds
                    },
                    lastMessageAt: {
                        gte: sinceDate
                    }
                },
                select: {
                    partnerId: true,
                    lastMessageAt: true,
                    messageCount: true,
                    userSentCount: true,
                    partnerSentCount: true,
                    responseRate: true,
                }
            }) as ChatInteraction[];


        } catch (error) {
            logger.error("Error finding chat interactions", {
                error: (error as Error).message,
            });
            throw new Error("Database error");
        }
    }

    /**
     * Find recent chat partners for a user
     */
    async findRecentPartners(
        userId: string,
        limit: number,
        sinceDate: Date
    ): Promise<ChatInteraction[]> {
        try {
            return await this.model.findMany({
                where: {
                    userId,
                    lastMessageAt: { gte: sinceDate },
                },
                orderBy: { lastMessageAt: "desc" },
                take: limit,
                select: {
                    partnerId: true,
                },
            }) as ChatInteraction[];
        } catch (error) {
            logger.error("Error finding recent partners", {
                error: (error as Error).message,
            });
            throw new Error("Database error");
        }
    }
}
