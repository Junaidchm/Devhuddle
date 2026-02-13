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
            logger.info("👉 [DEBUG] ChatRepository.createMessage called", { data: JSON.stringify(data) });
            return await super.create(data);
        } catch (error) {
            logger.error("Error creating message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getMessagesByConversationId(
        conversationId: string,
        limit: number,
        offset: number,
        before?: Date
    ): Promise<Message[]> {
        try {
            return await this.model.findMany({
                where: {
                    conversationId,
                    ...(before ? { createdAt: { lt: before } } : {})
                },
                take: limit,
                skip: before ? 0 : offset,
                orderBy: {
                    createdAt: 'desc'
                }
            });
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

    async findOrCreateConversation(participantIds: string[]): Promise<Conversation & { participants: Participant[] }> {
        try {
            logger.info("👉 [DEBUG] findOrCreateConversation", { participantIds });
            // ✅ FIXED: Use findMany to get ALL potential matches (where participants are a subset of provided IDs)
            // Then filter in memory for EXACT match. This prevents "findFirst" returning a subset conversation (e.g. self-chat)
            // and causing the code to skip the real group/pair chat and create a duplicate.
            const candidates = await prisma.conversation.findMany({
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

            // Find exact match
            const possibleConversation = candidates.find(c => 
                c.participants.length === participantIds.length && 
                c.participants.every(p => participantIds.includes(p.userId))
            );

            if (possibleConversation) {
                return possibleConversation;
            }

            const newConversation = await prisma.conversation.create({
                data: {
                    participants: {
                        create: participantIds.map((userId) => ({
                            userId
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

    async updateLastMessageAt(conversationId: string, timestamp: Date): Promise<void> {
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
                where: {
                    participants: {
                        some: {
                            userId
                        }
                    }
                },
                include: {
                    participants: true
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
                        take: 1
                    }
                },
                orderBy: {
                    lastMessageAt: 'desc'
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

    /**
     * Update a message (for status changes)
     */
    async updateMessage(messageId: string, data: Prisma.MessageUpdateInput): Promise<Message> {
        try {
            return await prisma.message.update({
                where: { id: messageId },
                data,
            });
        } catch (error) {
            logger.error("Error updating message", { error: (error as Error).message, messageId });
            throw new Error("Database error");
        }
    }

    /**
     * Find a message by ID
     */
    async findMessageById(messageId: string): Promise<Message | null> {
        try {
            return await prisma.message.findUnique({
                where: { id: messageId },
            });
        } catch (error) {
            logger.error("Error finding message by ID", { error: (error as Error).message, messageId });
            throw new Error("Database error");
        }
    }

    /**
     * Mark all messages before a timestamp as READ (excluding sender's own messages)
     */
    async markMessagesAsReadBefore(
        conversationId: string,
        excludeUserId: string,
        beforeTimestamp: Date
    ): Promise<void> {
        try {
            await prisma.message.updateMany({
                where: {
                    conversationId,
                    senderId: { not: excludeUserId }, // Don't mark own messages as read
                    createdAt: { lte: beforeTimestamp },
                    status: { not: 'READ' }, // Only update if not already READ
                },
                data: {
                    status: 'READ',
                    readAt: new Date(),
                },
            });
        } catch (error) {
            logger.error("Error marking messages as read", {
                error: (error as Error).message,
                conversationId,
                excludeUserId,
            });
            throw new Error("Database error");
        }
    }

    /**
     * Update participant's lastReadAt timestamp
     */
    async updateParticipantLastReadAt(
        conversationId: string,
        userId: string,
        timestamp: Date
    ): Promise<void> {
        try {
            await prisma.participant.updateMany({
                where: {
                    conversationId,
                    userId,
                },
                data: {
                    lastReadAt: timestamp,
                },
            });
        } catch (error) {
            logger.error("Error updating participant lastReadAt", {
                error: (error as Error).message,
                conversationId,
                userId,
            });
            throw new Error("Database error");
        }
    }


    async createGroupConversation(
        creatorId: string, 
        name: string, 
        participantIds: string[], 
        icon?: string,
        onlyAdminsCanPost: boolean = false,
        onlyAdminsCanEditInfo: boolean = false,
        topics: string[] = []
    ): Promise<Conversation & { participants: Participant[] }> {
        return await prisma.conversation.create({
            data: {
                type: 'GROUP',
                name,
                icon,
                ownerId: creatorId,
                onlyAdminsCanPost,
                onlyAdminsCanEditInfo,
                topics,
                participants: {
                    create: [
                        { userId: creatorId, role: 'ADMIN' },
                        ...participantIds.filter(id => id !== creatorId).map(id => ({ userId: id, role: 'MEMBER' as const }))
                    ]
                }
            },
            include: {
                participants: true
            }
        });
    }

    async findAllGroups(
        query?: string,
        topics?: string[],
        limit: number = 20,
        offset: number = 0
    ): Promise<(Conversation & { participants: Participant[] })[]> {
        const whereClause: Prisma.ConversationWhereInput = {
            type: 'GROUP',
            ...(query ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } }
                ]
            } : {}),
             ...(topics && topics.length > 0 ? {
                topics: {
                    hasSome: topics
                }
            } : {})
        };

        return await prisma.conversation.findMany({
            where: whereClause,
            include: {
                participants: true
            },
            take: limit,
            skip: offset,
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    async addParticipantToGroup(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER' = 'MEMBER'): Promise<void> {
        await prisma.participant.create({
            data: {
                conversationId: groupId,
                userId,
                role
            }
        });
    }

    async removeParticipantFromGroup(groupId: string, userId: string): Promise<void> {
        await prisma.participant.deleteMany({
            where: {
                conversationId: groupId,
                userId
            }
        });
    }

    async updateParticipantRole(groupId: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<void>  {
        await prisma.participant.updateMany({
            where: {
                conversationId: groupId,
                userId
            },
            data: { role }
        });
    }

    async updateGroupMetadata(
        groupId: string, 
        data: { 
            name?: string; 
            description?: string; 
            icon?: string;
            onlyAdminsCanPost?: boolean;
            onlyAdminsCanEditInfo?: boolean;
        }
    ): Promise<Conversation> {
        return await prisma.conversation.update({
            where: { id: groupId },
            data
        });
    }

    async deleteConversation(conversationId: string): Promise<void> {
        await prisma.$transaction([
            // Delete messages first
            prisma.message.deleteMany({
                where: { conversationId }
            }),
            // Delete participants
            prisma.participant.deleteMany({
                where: { conversationId }
            }),
            // Delete conversation
            prisma.conversation.delete({
                where: { id: conversationId }
            })
        ]);
        logger.info("Conversation deleted successfully", { conversationId });
    }

    async findParticipantInConversation(userId: string, conversationId: string): Promise<Participant & { role: 'ADMIN' | 'MEMBER' } | null> {
        // @ts-ignore - Prisma types update might be lagging, role is definitely there
        return await prisma.participant.findUnique({
            where: {
                userId_conversationId: {
                    userId,
                    conversationId
                }
            }
        }) as (Participant & { role: 'ADMIN' | 'MEMBER' }) | null;
    }
}


