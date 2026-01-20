import { IChatRepository, ConversationWithMetadata } from "../interfaces/IChatRepository"; 
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

    /**
     * Get user conversations with metadata (last message, unread count)
     * WhatsApp/LinkedIn-style enriched conversation list
     */

    
    async getUserConversationsWithMetadata(
        userId: string,
        limit: number,
        offset: number
    ): Promise<ConversationWithMetadata[]> {
        try {
            // Get conversations with participants and last message
            const conversations = await prisma.conversation.findMany({
                where: {
                    participants: {
                        some: {
                            userId
                        }
                    }
                },
                include: {
                    participants: true,
                    messages: {
                        orderBy: {
                            createdAt: 'desc'
                        },
                        take: 1 // Only get the last message
                    }
                },
                orderBy: {
                    lastMessageAt: 'desc' // Most recent conversations first
                },
                take: limit,
                skip: offset
            });

            // Calculate unread count for each conversation
            const conversationsWithMetadata = await Promise.all(
                conversations.map(async (conv) => {
                    // Find current user's participant record
                    const userParticipant = conv.participants.find(p => p.userId === userId);

                    // Count unread messages (messages after user's lastReadAt)
                    const unreadCount = await prisma.message.count({
                        where: {
                            conversationId: conv.id,
                            createdAt: {
                                gt: userParticipant?.lastReadAt ?? new Date(0)
                            },
                            senderId: {
                                not: userId // Don't count own messages
                            }
                        }
                    });

                    return {
                        ...conv,
                        lastMessage: conv.messages[0] || null,
                        unreadCount
                    };
                })
            );

            logger.info("Retrieved conversations with metadata", {
                userId,
                count: conversationsWithMetadata.length,
                limit,
                offset
            });

            return conversationsWithMetadata;
        } catch (error) {
            logger.error("Error getting conversations with metadata", {
                error: (error as Error).message,
                userId
            });
            throw new Error("Database error");
        }
    }

    /**
     * Check if conversation exists between users (no creation)
     * Used for duplicate prevention
     */
    async conversationExists(participantIds: string[]): Promise<Conversation | null> {
        try {
            // Find potential conversation
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
            });

            // Ensure EXACT match (same logic as findOrCreateConversation)
            if (
                possibleConversation &&
                possibleConversation.participants.length === participantIds.length &&
                possibleConversation.participants.every(p => participantIds.includes(p.userId))
            ) {
                logger.info("Conversation exists", {
                    conversationId: possibleConversation.id,
                    participantCount: participantIds.length
                });
                return possibleConversation;
            }

            logger.info("Conversation does not exist", {
                participantIds
            });
            return null;
        } catch (error) {
            logger.error("Error checking conversation existence", {
                error: (error as Error).message,
                participantIds
            });
            throw new Error("Database error");
        }
    }

    /**
     * Get the last message for a conversation
     */
    async getLastMessage(conversationId: string): Promise<Message | null> {
        try {
            const message = await prisma.message.findFirst({
                where: {
                    conversationId
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 1
            });

            logger.debug("Retrieved last message", {
                conversationId,
                messageId: message?.id || null
            });

            return message;
        } catch (error) {
            logger.error("Error getting last message", {
                error: (error as Error).message,
                conversationId
            });
            throw new Error("Database error");
        }
    }

}

