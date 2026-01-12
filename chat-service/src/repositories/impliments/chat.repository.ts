import { IChatRepository } from "../interfaces/IChatRepository"; 
import { BaseRepository } from "./base.repository";
import prisma from "../../config/db";
import logger from "../../utils/logger.util";
import { Message, Conversation, Prisma, Participant } from "@prisma/client";

export class ChatRepository extends BaseRepository<
    typeof prisma.message,
    Message,
    Prisma.MessageCreateInput,
    Prisma.MessageUpdateInput,
    Prisma.MessageWhereUniqueInput
> implements IChatRepository {

    constructor() {
        super(prisma.message);
    }

    async createMessage(data: Prisma.MessageCreateInput): Promise<Message> {
        try {
            return await super.create(data);
        } catch (error) {
            logger.error("Error creating message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getMessagesByConversationId(conversationId: string, limit: number, offset: number): Promise<Message[]> {
        try {
            return await this.model.findMany({
                where: {
                    conversationId
                },
                take: limit,
                skip: offset,

            })
        } catch (error) {
            logger.error("Error getting messages by conversation id", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null> {
        try {
            return await prisma.conversation.findUnique({
                where: {
                    id: conversationId
                },
                include: {
                    participants: true
                }
            }) as (Conversation & { participants: Participant[] }) | null;
        } catch (error) {
            logger.error("Error finding conversation by id", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async findOrCreateConversation(participantIds: string[]): Promise<Conversation> {
        try {
            const possibleConversation = await prisma.conversation.findFirst({
                where: {
                    participants: {
                        every: {
                            userId: {
                                in: participantIds
                            }
                        }
                    }
                },
                include: {
                    participants: true
                }
            })

            // Ensure EXACT match (no extra, no missing participants)
            if (possibleConversation && possibleConversation.participants.length === participantIds.length && possibleConversation.participants.every((participant) => participantIds.includes(participant.userId))) {
                return possibleConversation;
            }

            const newConversation = await prisma.conversation.create({
                data: {
                    participants: {
                        create: participantIds.map((userId) => ({
                            userId,
                            createdAt: new Date(),
                            lastReadAt: new Date()
                        }))
                    }
                },
                include: {
                    participants: true
                }
            })
            return newConversation;

        } catch (error) {
            logger.error("Error finding or creating conversation", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async updateLastMessageAt(conversationId: string, timestamp: Date):Promise<void>{
        try {
            await prisma.conversation.update({
                where: {
                    id: conversationId
                },
                data: {
                    lastMessageAt: timestamp
                }
            })
        } catch (error) {
            logger.error("Error updating last message at", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getUserConversations(userId: string): Promise<Conversation[]> {
        try {
            return await prisma.conversation.findMany({
                where : {
                    participants: {
                        some : {
                            userId
                        }
                    }
                },
                include : {
                    participants : true
                }
            })
        } catch (error) {
            logger.error("Error getting user conversations", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

}

