import { IChatRepository, ConversationWithMetadata } from "../interfaces/IChatRepository";
import { BaseRepository } from "./base.repository";
import prisma from "../../config/db";
import logger from "../../utils/logger.util";
import { Message, Conversation, Prisma, Participant, Report as PrismaReport } from "@prisma/client";

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
            // Override base create to include relations
            return await this.model.create({
                data,
                include: {
                    replyTo: true,
                    reactions: true
                }
            });
        } catch (error) {
            logger.error("Error creating message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getMessagesByConversationId(
        conversationId: string,
        userId: string,
        limit: number,
        offset: number,
        before?: Date
    ): Promise<Message[]> {
        try {
            // Find user's participant record to check lastClearedAt
            const participant = await prisma.participant.findUnique({
                where: { userId_conversationId: { userId, conversationId } }
            });

            return await this.model.findMany({
                where: {
                    conversationId,
                    ...(before ? { createdAt: { lt: before } } : {}),
                    ...(participant?.lastClearedAt ? { createdAt: { gt: participant.lastClearedAt } } : {}),
                    NOT: {
                        deletedFor: {
                            has: userId
                        }
                    }
                },
                take: limit,
                skip: before ? 0 : offset,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    replyTo: true,
                    reactions: true
                }
            });
        } catch (error) {
            logger.error("Error getting messages by conversation id", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getMessagesByType(
        conversationId: string,
        userId: string,
        types: string[],
        limit: number,
        offset: number
    ): Promise<Message[]> {
        try {
            const participant = await prisma.participant.findUnique({
                where: { userId_conversationId: { userId, conversationId } }
            });

            return await this.model.findMany({
                where: {
                    conversationId,
                    type: { in: types as any },
                    ...(participant?.lastClearedAt ? { createdAt: { gt: participant.lastClearedAt } } : {}),
                    NOT: {
                        deletedFor: {
                            has: userId
                        }
                    }
                },
                take: limit,
                skip: offset,
                orderBy: {
                    createdAt: 'desc'
                }
            });
        } catch (error) {
            logger.error("Error getting messages by type", { error: (error as Error).message });
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
            
            // Calculate hash for exact match
            const participantHash = participantIds.sort().join(',');

            // Attempt to find by hash (fast & unique)
            const existingConversation = await prisma.conversation.findUnique({
                where: {
                    participantHash
                },
                include: {
                    participants: true
                }
            });

            if (existingConversation) {
                logger.info("Found existing conversation by hash", { conversationId: existingConversation.id });
                return existingConversation;
            }

            // If still not found, create new one
            // Using upsert would be ideal but since we need to include participants creation 
            // it's cleaner to handle race condition with catches
            try {
                const newConversation = await prisma.conversation.create({
                    data: {
                        participantHash,
                        lastMessageAt: new Date(), // Initialize timestamp for sorting
                        participants: {
                            create: participantIds.map((userId) => ({
                                userId
                            }))
                        },
                        memberCount: participantIds.length
                    },
                    include: {
                        participants: true
                    }
                });
                return newConversation;
            } catch (createError: any) {
                // Handle race condition: if another request created it between findUnique and create
                if (createError.code === 'P2002') { // Prisma unique constraint violation
                    logger.info("Race condition: conversation created concurrently, refetching...");
                    return await prisma.conversation.findUnique({
                        where: { participantHash },
                        include: { participants: true }
                    }) as Conversation & { participants: Participant[] };
                }
                throw createError;
            }

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
                            userId,
                            deletedAt: null
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
                    isSuspended: false,
                    participants: {
                        some: {
                            userId,
                            deletedAt: null
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

            // NEW: Get all unread counts in a single query to avoid N+1
            const conversationIds = conversations.map(c => c.id);
            const [unreadCounts, blockOps] = await Promise.all([
                conversationIds.length > 0 
                  ? prisma.$queryRaw<any[]>`
                    SELECT m."conversationId", COUNT(m.id)::int as count
                    FROM "Message" m
                    JOIN "Participant" p ON m."conversationId" = p."conversationId"
                    WHERE p."userId" = ${userId}
                      AND m."senderId" != ${userId}
                      AND m."createdAt" > p."lastReadAt"
                      AND m."conversationId" IN (${Prisma.join(conversationIds)})
                    GROUP BY m."conversationId"
                `
                : Promise.resolve([]),
                this.getBlockRelationships(userId)
            ]);

            const unreadCountMap = new Map(unreadCounts.map((uc: any) => [uc.conversationId, uc.count]));

            const conversationsWithMetadata = conversations.map(conv => {
                return {
                    ...conv,
                    lastMessage: conv.messages[0] || null,
                    unreadCount: unreadCountMap.get(conv.id) || 0
                };
            });

            const blockedByMe = new Set(blockOps.blockedByMe);
            const blockedMe = new Set(blockOps.blockedMe);

            const enrichedConversations = conversationsWithMetadata.map(conv => {
                const otherParticipant = conv.type === 'DIRECT' 
                    ? conv.participants.find(p => p.userId !== userId)
                    : null;
                
                return {
                    ...conv,
                    isBlockedByMe: otherParticipant ? blockedByMe.has(otherParticipant.userId) : false,
                    isBlockedByThem: otherParticipant ? blockedMe.has(otherParticipant.userId) : false
                };
            });

            logger.info("Retrieved conversations with metadata and block status", {
                userId,
                count: enrichedConversations.length,
                limit,
                offset
            });

            return enrichedConversations as any;
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
            const participantHash = participantIds.sort().join(',');
            
            const possibleConversation = await prisma.conversation.findUnique({
                where: {
                    participantHash
                },
                include: {
                    participants: true
                }
            });

            if (possibleConversation) {
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

    async findMessageWithContext(messageId: string): Promise<(Message & { conversation: Conversation & { participants: Participant[] } }) | null> {
        return await prisma.message.findUnique({
            where: { id: messageId },
            include: {
                conversation: {
                    include: {
                        participants: true
                    }
                }
            }
        });
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

    /**
     * Create MessageReceipt records for all given users
     */
    async createMessageReceipts(messageId: string, userIds: string[]): Promise<void> {
        try {
            if (userIds.length === 0) return;
            
            await prisma.messageReceipt.createMany({
                data: userIds.map(userId => ({
                    messageId,
                    userId
                })),
                skipDuplicates: true
            });
            logger.info("Created message receipts", { messageId, count: userIds.length });
        } catch (error) {
            logger.error("Error creating message receipts", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    /**
     * Update a user's MessageReceipt status and trigger aggregation
     */
    async updateMessageReceipt(messageId: string, userId: string, status: 'DELIVERED' | 'READ'): Promise<void> {
        try {
            const updateData = status === 'DELIVERED' 
                ? { deliveredAt: new Date() } 
                : { seenAt: new Date() };

            await prisma.messageReceipt.upsert({
                where: {
                    messageId_userId: { messageId, userId }
                },
                update: updateData,
                create: {
                    messageId,
                    userId,
                    ...updateData
                }
            });
        } catch (error) {
            logger.error("Error updating message receipt", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    /**
     * Aggregate MessageReceipt statuses to dynamically update the root Message status
     * Returns the updated Message
     */
    async aggregateMessageStatus(messageId: string): Promise<Message> {
        try {
            // Fetch message and its receipts separately to avoid type conflicts
            const message = await prisma.message.findUnique({
                where: { id: messageId }
            });

            if (!message) throw new Error("Message not found");

            const statusStr = message.status as string;
            // Avoid reverting already READ messages
            if (statusStr === 'READ') return message;

            let expectedCount = (message as any).expectedRecipientCount as number;
            
            // Fallback for direct chats if expectedRecipientCount is missing or 0
            if ((expectedCount === 0 || expectedCount === undefined) && message.type !== 'SYSTEM') {
                const conversation = await prisma.conversation.findUnique({
                    where: { id: message.conversationId },
                    select: { type: true }
                });
                if (conversation?.type === 'DIRECT') {
                    expectedCount = 1;
                }
            }

            if (expectedCount === 0 || expectedCount === undefined) return message;

            const receipts = await prisma.messageReceipt.findMany({
                where: { messageId }
            });

            const deliveredCount = receipts.filter((r: any) => r.deliveredAt !== null || r.seenAt !== null).length;
            const seenCount = receipts.filter((r: any) => r.seenAt !== null).length;

            let newStatusStr: string = statusStr;

            if (seenCount >= expectedCount) {
                newStatusStr = 'READ';
            } else if (deliveredCount >= expectedCount && statusStr !== 'READ') {
                newStatusStr = 'DELIVERED';
            }

            if (newStatusStr !== statusStr) {
                const updateData: Prisma.MessageUpdateInput = { status: newStatusStr as any };
                if (newStatusStr === 'DELIVERED') updateData.deliveredAt = new Date();
                if (newStatusStr === 'READ') updateData.readAt = new Date();

                return await prisma.message.update({
                    where: { id: messageId },
                    data: updateData,
                    include: { replyTo: true, reactions: true }
                });
            }

            return message;
        } catch (error) {
            logger.error("Error aggregating message status", { error: (error as Error).message });
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
        const allParticipants = [creatorId, ...participantIds.filter(id => id !== creatorId)];
        const participantHash = allParticipants.sort().join(',');

        return await prisma.conversation.create({
            data: {
                type: 'GROUP',
                name,
                icon,
                ownerId: creatorId,
                onlyAdminsCanPost,
                onlyAdminsCanEditInfo,
                topics,
                lastMessageAt: new Date(), // Initialize for correct sorting in conversion list
                memberCount: allParticipants.length,
                // participantHash is NOT set for groups to allow multiple groups with same members
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
            isSuspended: false,
            deletedAt: null,
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

    async findMyGroups(
        userId: string,
        query?: string,
        limit: number = 20,
        offset: number = 0
    ): Promise<(Conversation & { participants: Participant[] })[]> {
        const whereClause: Prisma.ConversationWhereInput = {
            type: 'GROUP',
            isSuspended: false,
            deletedAt: null,
            participants: {
                some: { 
                    userId,
                    deletedAt: null // Fix: Ensure user is an active participant
                }
            },
            ...(query ? {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } }
                ]
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

    async findDiscoverGroups(
        userId: string,
        query?: string,
        topics?: string[],
        limit: number = 20,
        offset: number = 0
    ): Promise<(Conversation & { participants: Participant[] })[]> {
        const whereClause: Prisma.ConversationWhereInput = {
            type: 'GROUP',
            isSuspended: false,
            deletedAt: null,
            // Removed participants: { none: { userId } } to allow discovery of all public hubs
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

    async getPopularTopics(limit: number = 10): Promise<{ topic: string, count: number }[]> {
        try {
            const result = await prisma.$queryRaw<{topic: string, count: number}[]>`
                SELECT unnest(topics) as topic, count(*)::int as count 
                FROM "Conversation" 
                WHERE type = 'GROUP' 
                GROUP BY topic 
                ORDER BY count DESC 
                LIMIT ${limit}
            `;
            return result;
        } catch (error) {
            logger.error("Error fetching popular topics", { error: (error as Error).message });
            return [];
        }
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

    async searchMessages(conversationId: string, userId: string, query: string): Promise<Message[]> {
        try {
            return await prisma.message.findMany({
                where: {
                    conversationId,
                    content: {
                        contains: query,
                        mode: 'insensitive'
                    },
                    NOT: {
                        deletedFor: {
                            has: userId
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                take: 50
            });
        } catch (error) {
            logger.error("Error searching messages", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }
    async editMessage(messageId: string, content: string): Promise<Message> {
        try {
            return await prisma.message.update({
                where: { id: messageId },
                data: { content, updatedAt: new Date() }
            });
        } catch (error) {
            logger.error("Error editing message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async deleteMessage(messageId: string): Promise<void> {
        try {
            await prisma.message.update({
                where: { id: messageId },
                data: { 
                    deletedForAll: true,
                    content: "This message was deleted"
                }
            });
        } catch (error) {
            logger.error("Error deleting message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async deleteMessageForMe(messageId: string, userId: string): Promise<void> {
        try {
            await prisma.message.update({
                where: { id: messageId },
                data: {
                    deletedFor: { push: userId }
                }
            });
        } catch (error) {
            logger.error("Error deleting message for user", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        try {
             // Check if already reacted
            const existing = await prisma.messageReaction.findFirst({
                where: { messageId, userId, emoji }
            });

            if (existing) return;

            await prisma.messageReaction.create({
                data: { messageId, userId, emoji }
            });
        } catch (error) {
            logger.error("Error adding reaction", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        try {
            await prisma.messageReaction.deleteMany({
                where: { messageId, userId, emoji }
            });
        } catch (error) {
            logger.error("Error removing reaction", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getReactions(messageId: string): Promise<any[]> {
        try {
            return await prisma.messageReaction.findMany({
                where: { messageId }
            });
        } catch (error) {
            logger.error("Error getting reactions", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getUserReactionOnMessage(messageId: string, userId: string): Promise<any | null> {
        try {
            return await prisma.messageReaction.findFirst({
                where: { messageId, userId }
            });
        } catch (error) {
            logger.error("Error getting user reaction", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async pinMessage(messageId: string, userId: string): Promise<Message> {
        try {
            return await prisma.message.update({
                where: { id: messageId },
                data: { isPinned: true, pinnedAt: new Date(), pinnedBy: userId }
            });
        } catch (error) {
            logger.error("Error pinning message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async unpinMessage(messageId: string): Promise<Message> {
        try {
            return await prisma.message.update({
                where: { id: messageId },
                data: { isPinned: false, pinnedAt: null, pinnedBy: null }
            });
        } catch (error) {
            logger.error("Error unpinning message", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getPinnedMessages(conversationId: string, userId: string): Promise<Message[]> {
        try {
            return await prisma.message.findMany({
                where: { 
                    conversationId, 
                    isPinned: true,
                    NOT: {
                        deletedFor: {
                            has: userId
                        }
                    }
                },
                orderBy: { pinnedAt: 'desc' }
            });
        } catch (error) {
            logger.error("Error getting pinned messages", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async blockUser(blockerId: string, blockedId: string): Promise<void> {
        try {
            await prisma.blockedUser.upsert({
                where: { blockerId_blockedId: { blockerId, blockedId }},
                update: {},
                create: { blockerId, blockedId }
            });
        } catch (error) {
            logger.error("Error blocking user", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async unblockUser(blockerId: string, blockedId: string): Promise<void> {
        try {
            await prisma.blockedUser.delete({
                where: { blockerId_blockedId: { blockerId, blockedId }}
            });
        } catch (error) {
            // Check if error is "Record to delete does not exist"
             if ((error as any).code === 'P2025') {
                return; // Already unblocked
            }
            logger.error("Error unblocking user", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getBlockedUsers(userId: string): Promise<any[]> {
        try {
            return await prisma.blockedUser.findMany({
                where: { blockerId: userId }
            });
        } catch (error) {
             logger.error("Error getting blocked users", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async isUserBlocked(blockerId: string, blockedId: string): Promise<boolean> {
        try {
            const count = await prisma.blockedUser.count({
                where: { 
                    OR: [
                        { blockerId, blockedId },
                        { blockerId: blockedId, blockedId: blockerId }
                    ]
                }
            });
            return count > 0;
        } catch (error) {
             logger.error("Error checking check blocked status", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getBlockRelationships(userId: string): Promise<{ blockedByMe: string[], blockedMe: string[] }> {
        try {
            const relationships = await prisma.blockedUser.findMany({
                where: { OR: [{ blockerId: userId }, { blockedId: userId }] }
            });
            return {
                blockedByMe: relationships.filter(r => r.blockerId === userId).map(r => r.blockedId),
                blockedMe: relationships.filter(r => r.blockedId === userId).map(r => r.blockerId),
            };
        } catch (error) {
             logger.error("Error getting block relationships", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async softDeleteConversation(conversationId: string, userId: string): Promise<void> {
        try {
            await prisma.participant.update({
                where: { userId_conversationId: { userId, conversationId } },
                data: { deletedAt: new Date(), lastClearedAt: new Date() }
            });
        } catch (error) {
            logger.error("Error soft deleting conversation", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async clearChatHistory(conversationId: string, userId: string): Promise<void> {
        try {
            await prisma.participant.update({
                where: { userId_conversationId: { userId, conversationId } },
                data: { lastClearedAt: new Date() }
            });
        } catch (error) {
            logger.error("Error clearing chat history", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getCommonGroups(userId1: string, userId2: string): Promise<Conversation[]> {
        try {
            return await prisma.conversation.findMany({
                where: {
                    type: 'GROUP',
                    AND: [
                        { participants: { some: { userId: userId1 } } },
                        { participants: { some: { userId: userId2 } } }
                    ]
                },
                include: {
                    participants: true
                }
            });
        } catch (error) {
            logger.error("Error getting common groups", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async saveMessageLinks(messageId: string, urls: string[]): Promise<void> {
        try {
            await prisma.messageLink.createMany({
                data: urls.map(url => ({
                    messageId,
                    url,
                    // Title and thumbnail extraction could be added here in the future
                }))
            });
        } catch (error) {
            logger.error("Error saving message links", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getConversationLinks(conversationId: string, limit: number, offset: number): Promise<any[]> {
        try {
            return await prisma.messageLink.findMany({
                where: {
                    message: {
                        conversationId
                    }
                },
                take: limit,
                skip: offset,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    message: true
                }
            });
        } catch (error) {
            logger.error("Error getting conversation links", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    /**
     * Delete ALL SYSTEM messages for a direct conversation.
     * Called before creating a new block/unblock system message so that
     * only 1 pill exists at a time, regardless of old content format.
     */
    async deleteBlockSystemMessages(conversationId: string): Promise<void> {
        try {
            await prisma.message.deleteMany({
                where: {
                    conversationId,
                    type: 'SYSTEM'
                }
            });
            logger.debug("Cleared all SYSTEM messages for conversation", { conversationId });
        } catch (error) {
            logger.error("Error deleting block system messages", { error: (error as Error).message, conversationId });
            // Non-fatal — continue with new message creation
        }
    }

    // Reporting
    async createReport(data: Prisma.ReportCreateInput): Promise<PrismaReport> {
        try {
            return await prisma.report.create({ data });
        } catch (error) {
            logger.error("Error creating report", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async getReportsByConversationId(conversationId: string): Promise<PrismaReport[]> {
        try {
            return await prisma.report.findMany({
                where: { conversationId },
                orderBy: { createdAt: "desc" }
            });
        } catch (error) {
            logger.error("Error getting reports", { error: (error as Error).message, conversationId });
            throw new Error("Database error");
        }
    }

    async findReportById(reportId: string): Promise<PrismaReport | null> {
        try {
            return await prisma.report.findUnique({
                where: { id: reportId }
            });
        } catch (error) {
            logger.error("Error finding report", { error: (error as Error).message, reportId });
            throw new Error("Database error");
        }
    }

    async getConversationCount(where?: Prisma.ConversationWhereInput): Promise<number> {
        try {
            return await prisma.conversation.count({ where });
        } catch (error) {
            logger.error("Error getting conversation count", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async findHubsWithReportCount(
        where: Prisma.ConversationWhereInput,
        limit: number = 20,
        offset: number = 0
    ): Promise<(Conversation & { participants: Participant[]; _count: { reports: number } })[]> {
        try {
            return await prisma.conversation.findMany({
                where,
                include: {
                    participants: true,
                    _count: {
                        select: {
                            reports: true,
                        },
                    },
                },
                take: limit,
                skip: offset,
                orderBy: {
                    createdAt: "desc",
                },
            }) as (Conversation & { participants: Participant[]; _count: { reports: number } })[];
        } catch (error) {
            logger.error("Error finding hubs with report count", { error: (error as Error).message });
            throw new Error("Database error");
        }
    }

    async findHubByIdWithReportCount(
        hubId: string
    ): Promise<(Conversation & { participants: Participant[]; _count: { reports: number } }) | null> {
        try {
            return await prisma.conversation.findUnique({
                where: { id: hubId },
                include: {
                    participants: true,
                    _count: {
                        select: {
                            reports: true,
                        },
                    },
                },
            }) as (Conversation & { participants: Participant[]; _count: { reports: number } }) | null;
        } catch (error) {
            logger.error("Error finding hub by id with report count", {
                error: (error as Error).message,
                hubId,
            });
            throw new Error("Database error");
        }
    }

    async updateConversation(conversationId: string, data: Prisma.ConversationUpdateInput): Promise<Conversation> {
        try {
            return await prisma.conversation.update({
                where: { id: conversationId },
                data,
            });
        } catch (error) {
            logger.error("Error updating conversation", { error: (error as Error).message, conversationId });
            throw new Error("Database error");
        }
    }

    async updateMemberCount(conversationId: string, delta: number): Promise<number> {
        try {
            const updated = await prisma.conversation.update({
                where: { id: conversationId },
                data: {
                    memberCount: {
                        increment: delta
                    }
                }
            });
            logger.info("Updated member count", { conversationId, delta, newCount: updated.memberCount });
            return updated.memberCount;
        } catch (error) {
            logger.error("Error updating member count", { conversationId, delta, error: (error as Error).message });
            throw error;
        }
    }

    async syncAllMemberCounts(): Promise<void> {
        try {
            logger.info("🔄 Starting global member count synchronization...");
            const conversations = await prisma.conversation.findMany({
                include: {
                    _count: {
                        select: { participants: true }
                    }
                }
            });

            for (const conv of conversations) {
                await prisma.conversation.update({
                    where: { id: conv.id },
                    data: { memberCount: conv._count.participants }
                });
            }
            logger.info("✅ Global member count synchronization complete", { count: conversations.length });
        } catch (error) {
            logger.error("❌ Failed to sync member counts", { error: (error as Error).message });
            throw error;
        }
    }
}
