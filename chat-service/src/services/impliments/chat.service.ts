import { MessageResponseDto } from "../../dtos/response/message.dto";
import { IChatService } from "../interfaces/IChatService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { MessageSagaService } from "./message.service";
import { Message, Conversation, Prisma, Participant, GroupRole } from "@prisma/client";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { authServiceClient } from "../../clients/auth-service.client";
import { ChatActionService } from "./chat-action.service";
import prisma from "../../config/db";
import { redisPublisher } from "../../config/redis.config";
import {
    SendMessageCommand,
    CreateConversationCommand,
    GetMessagesQuery,
    GetUserConversationsQuery,
    GetUserConversationsWithMetadataQuery,
    CheckConversationExistsQuery,
    ConversationWithMetadataDto
} from "../../dtos/chat-service.dto";
import { MessageMapper } from "../../mappers/chat.mapper";

export class ChatService implements IChatService {

    constructor(
        private _messageSagaService: MessageSagaService, 
        private _chatRepository: IChatRepository,
        private _chatActionService: ChatActionService
    ) {}

    /**
     * Send a message (uses Command pattern with business validation)
     * Invalidates cache after sending
     */
    async sendMessage(
        senderId: string, 
        recipientIds: string[], 
        content: string,
        // Optional media params
        messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'SYSTEM' = 'TEXT',
        mediaUrl?: string,
        mediaId?: string,
        mediaMimeType?: string,
        mediaSize?: number,
        mediaName?: string,
        mediaDuration?: number,
        conversationId?: string,
        dedupeId?: string,
        replyToId?: string,
        isForwarded?: boolean,
        forwardedFrom?: string,
        originalMessageId?: string
    ): Promise<Message> {
        try {
            // Create and validate command (business rules validated here)
            const command = new SendMessageCommand(
                senderId, 
                recipientIds, 
                content,
                messageType,
                mediaUrl,
                mediaId,
                mediaMimeType,
                mediaSize,
                mediaName,
                mediaDuration,
                conversationId,
                dedupeId,
                replyToId,
                isForwarded,
                forwardedFrom,
                originalMessageId
            );

            // Delegate entire saga to MessageSagaService
            return await this._messageSagaService.sendMessage(command);
        } catch (error) {
            logger.error("Error in sendMessage service", { error: (error as Error).message });
            throw error; // Re-throw to preserve business validation errors
        }
    }

    /**
     * Get conversation messages (uses Query pattern with business validation)
     * Implements cache-aside pattern
     */
    async getConversationMessages(conversationId: string, userId: string, limit: number, offset: number, before?: Date): Promise<Message[]> {
        try {
            // Validate limits (capped at 100)
            const safeLimit = Math.min(limit, 100);

            // ✅ OPTIMIZATION: If requesting a temporary ID (optimistic), return empty immediately
            if (conversationId.startsWith('temp-') || conversationId.startsWith('optimistic-')) {
                logger.info("Skipping fetch for temporary conversation ID", { conversationId });
                return [];
            }

            // check cache first? (Caching with cursors is tricky, maybe skip for now or cache head only)
            // For now, let's hit DB for safety with cursors to ensure no gaps

            // Verify user is a participant (could be cached)
            // For now, let's just get messages - repository will return empty if not found? 
            // Actually verification is good.
            // Verify user is a participant using a targeted check
            const participant = await this._chatRepository.findParticipantInConversation(userId, conversationId);

            if (!participant) {
                // Check if conversation exists at all to provide better error message
                const conversationExists = await this._chatRepository.findConversationById(conversationId);
                if (!conversationExists) {
                    throw new Error("Conversation not found");
                }
                throw new Error("Unauthorized: User is not a participant in this conversation");
            }

            // Get messages from database using offset-based pagination
            const messages = await this._chatRepository.getMessagesByConversationId(
                conversationId,
                userId,
                safeLimit,
                offset,
                before
            );

            // Enrich with sender details
            const senderIds = Array.from(new Set(messages.map(m => m.senderId)));
            let userProfilesMap = new Map<string, any>();
            
            if (senderIds.length > 0) {
                try {
                    userProfilesMap = await authServiceClient.getUserProfiles(senderIds);
                } catch (error) {
                    logger.warn("Failed to fetch user profiles for messages", { error: (error as Error).message });
                }
            }

            const enrichedMessages = messages.map(message => {
                // Use Mapper to get standard DTO (handles replyTo, reactions, etc.)
                // We need to import MessageMapper first
                const dto = MessageMapper.toResponseDto(message);
                
                const profile = userProfilesMap.get(message.senderId);
                
                return {
                    ...dto, // Spread DTO fields (includes formatted replyTo)
                    sender: profile ? {
                        id: message.senderId,
                        username: profile.username,
                        email: profile.email,
                        profileImage: profile.profilePhoto,
                        isOnline: profile.isOnline
                    } : undefined
                };
            });

            logger.info("Retrieved conversation messages from DB", {
                conversationId,
                userId,
                messageCount: messages.length,
                offset
            });

            return enrichedMessages as unknown as Message[];
        } catch (error) {
            logger.error("Error in getConversationMessages service", { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Get user conversations (uses Query pattern with business validation)
     * Implements cache-aside pattern
     */
    async getUserConversations(userId: string): Promise<Conversation[]> {
        try {
            // Create and validate query (business rules validated here)
            const query = new GetUserConversationsQuery(userId);

            // Try to get from cache first
            const cachedConversations = await RedisCacheService.getCachedUserConversations(query.userId);

            if (cachedConversations) {
                logger.info("Retrieved user conversations from cache", {
                    userId: query.userId,
                    conversationCount: cachedConversations.length
                });
                return cachedConversations;
            }

            // Cache miss - get from database
            const conversations = await this._chatRepository.getUserConversations(query.userId);

            // Cache the results
            await RedisCacheService.cacheUserConversations(query.userId, conversations);

            logger.info("Retrieved user conversations from DB", {
                userId: query.userId,
                conversationCount: conversations.length
            });

            return conversations;
        } catch (error) {
            logger.error("Error in getUserConversations service", { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Find or create conversation and return enriched metadata
     * Returns full conversation object with user profiles for immediate frontend use
     */
    async findOrCreateConversation(participantIds: string[]): Promise<ConversationWithMetadataDto> {
        try {
            // We need to extract initiator - assume first participant is initiator
            const [initiatorId, ...otherParticipants] = participantIds;

            // Create and validate command (business rules validated here)
            const command = new CreateConversationCommand(initiatorId, otherParticipants);

            // Get all unique participants
            const allParticipants = command.getAllParticipants();

            const conversation = await this._chatRepository.findOrCreateConversation(allParticipants);

            // Always bump lastMessageAt to now so the conversation sorts to the top of the
            // user's conversation list (ORDER BY lastMessageAt DESC).
            // For brand-new conversations the create already sets it to now(), so this is a fast no-op.
            // For existing conversations re-opened from the suggestions modal this guarantees
            // the conversation is not buried behind older conversations after a page refresh.
            await this._chatRepository.updateLastMessageAt(conversation.id, new Date());
            conversation.lastMessageAt = new Date(); // keep in-memory object consistent

            // Invalidate user conversations cache for all participants
            for (const participantId of allParticipants) {
                await RedisCacheService.invalidateUserConversationsCache(participantId);
                await RedisCacheService.invalidateUserConversationsMetadataCache(participantId);
            }

            logger.info("Found or created conversation", {
                conversationId: conversation.id,
                participantCount: allParticipants.length
            });

            // Enrich with user profiles via gRPC (same logic as getUserConversationsWithMetadata)
            const userProfilesMap = await authServiceClient.getUserProfiles(allParticipants);

            // Build enriched conversation DTO
            const enrichedConversation: ConversationWithMetadataDto = {
                conversationId: conversation.id,
                type: conversation.type as 'DIRECT' | 'GROUP',
                name: conversation.name,
                icon: conversation.icon,
                description: conversation.description,
                ownerId: conversation.ownerId,
                participantIds: allParticipants,
                participants: allParticipants.map(userId => {
                    const profile = userProfilesMap.get(userId);
                    return {
                        userId,
                        username: profile?.username || 'unknown',
                        // ✅ FIX: Fallback to username if name is missing/empty
                        // This prevents "Unknown User" when we have a valid username
                        name: profile?.name || profile?.username || 'Unknown User',
                        profilePhoto: profile?.profilePhoto || null,
                        isOnline: profile?.isOnline || false,
                        lastSeen: profile?.lastSeen || ""
                    };
                }),
                lastMessage: null,
                lastMessageAt: conversation.lastMessageAt, // use the bumped timestamp so frontend sorts correctly
                unreadCount: 0,
                createdAt: conversation.createdAt
            };

            return enrichedConversation;
        } catch (error) {
            logger.error("Error in findOrCreateConversation service", { error: (error as Error).message });
            throw error;
        }
    }

    async findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null> {
        try {
            // Try cache first
            const cachedConversation = await RedisCacheService.getCachedConversation(conversationId);

            if (cachedConversation) {
                return cachedConversation;
            }

            // Cache miss - get from database
            const conversation = await this._chatRepository.findConversationById(conversationId);

            if (!conversation || conversation.isSuspended || conversation.deletedAt) {
                return null;
            }

            // Cache the result
            await RedisCacheService.cacheConversation(conversationId, conversation);

            return conversation;
        } catch (error) {
            logger.error("Error in findConversationById service", { error: (error as Error).message });
            throw new Error("Failed to find conversation");
        }
    }

    /**
     * Get user conversations with metadata (uses Query pattern with business validation)
     * Returns enriched conversation list with user profiles from auth-service
     * Implements cache-aside pattern with 2-minute TTL
     */
    async getUserConversationsWithMetadata(
        userId: string,
        limit: number = 50,
        offset: number = 0
    ): Promise<ConversationWithMetadataDto[]> {
        try {
            // Create and validate query (business rules validated here)
            const query = new GetUserConversationsWithMetadataQuery(userId, limit, offset);

            // Try cache first (2 min TTL via dedicated cache method)
            const cached = await RedisCacheService.getCachedUserConversationsWithMetadata(
                query.userId,
                query.limit,
                query.offset
            );

            if (cached) {
                logger.info("Retrieved conversations with metadata from cache", {
                    userId: query.userId,
                    conversationCount: cached.length
                });
                return cached;
            }

            // Cache miss - get from repository with metadata
            const conversationsWithMetadata = await this._chatRepository.getUserConversationsWithMetadata(
                query.userId,
                query.limit,
                query.offset
            );

            logger.info("Retrieved conversations with metadata from DB", {
                userId: query.userId,
                conversationCount: conversationsWithMetadata.length,
                limit: query.limit,
                offset: query.offset
            });

            // If no conversations, return early (don't cache empty results)
            if (conversationsWithMetadata.length === 0) {
                logger.info("No conversations found for user", { userId: query.userId });
                return [];
            }

            // Enrich with user data from auth-service via gRPC
            // Collect all unique participant IDs across all conversations
            const allParticipantIds = new Set<string>();
            conversationsWithMetadata.forEach((conv) => {
                if (!conv.participants || !Array.isArray(conv.participants)) {
                    logger.error("Conversation has invalid participants structure", {
                        conversationId: conv.id,
                        participants: conv.participants
                    });
                    return;
                }
                conv.participants.forEach(p => {
                    if (p && p.userId) {
                        allParticipantIds.add(p.userId);
                    } else {
                        logger.warn("Participant missing userId", { participant: p });
                    }
                });
            });

            logger.info("Collected participant IDs", {
                conversationCount: conversationsWithMetadata.length,
                uniqueParticipants: allParticipantIds.size,
                participantIds: Array.from(allParticipantIds)
            });

            // Fetch user profiles via gRPC
            let userProfilesMap: Map<string, any>;
            try {
                userProfilesMap = await authServiceClient.getUserProfiles(
                    Array.from(allParticipantIds)
                );

                console.log("userProfilesMap ---------------------------->", userProfilesMap);

                logger.info("Enriching conversations with user profiles", {
                    conversationCount: conversationsWithMetadata.length,
                    uniqueUsers: allParticipantIds.size,
                    profilesFetched: userProfilesMap.size
                });

                // If gRPC failed and returned empty profiles, log warning but continue instead of dropping the conversation list
                if (allParticipantIds.size > 0 && userProfilesMap.size === 0) {
                    logger.error("gRPC returned no profiles despite having participant IDs", {
                        expectedProfiles: allParticipantIds.size,
                        conversationCount: conversationsWithMetadata.length
                    });
                    // We will NOT return [] here because we don't want to drop the conversation if gRPC is flaky.
                    // Instead, the fallback logic below will handle it by showing "User ID".
                }
            } catch (error) {
                logger.error("Failed to fetch user profiles from gRPC", {
                    error: (error as Error).message,
                    participantCount: allParticipantIds.size
                });
                // Create an empty map to ensure fallback mapping works
                userProfilesMap = new Map();
            }

            // Fetch block relationships for the current user
            const blockOps = await this._chatRepository.getBlockRelationships(userId);
            const blockedByMe = new Set(blockOps.blockedByMe);
            const blockedMe = new Set(blockOps.blockedMe);

            // Map to enriched DTOs with user profile data
            const enrichedConversations: ConversationWithMetadataDto[] = conversationsWithMetadata.map((conv) => {
                const otherParticipant = conv.type === 'DIRECT' 
                    ? conv.participants.find(p => p.userId !== userId)
                    : null;
                const isBlockedByMe = otherParticipant ? blockedByMe.has(otherParticipant.userId) : false;
                const isBlockedByThem = otherParticipant ? blockedMe.has(otherParticipant.userId) : false;

                return {
                    conversationId: conv.id,
                    type: conv.type as 'DIRECT' | 'GROUP',
                    name: conv.name,
                    icon: conv.icon,
                    description: conv.description,
                    ownerId: conv.ownerId,
                    // ✅ FIX: Include permission fields for group settings
                    onlyAdminsCanPost: conv.onlyAdminsCanPost,
                    onlyAdminsCanEditInfo: conv.onlyAdminsCanEditInfo,
                    participantIds: conv.participants.map(p => p.userId),
                    // Enrich participants with profile data from gRPC
                    participants: conv.participants.map(p => {
                        const profile = userProfilesMap.get(p.userId);
                        if (!profile) {
                            logger.warn("No profile found for participant", {
                                userId: p.userId,
                                conversationId: conv.id
                            });
                        }
                        return {
                            userId: p.userId,
                            username: profile?.username || `user_${p.userId.slice(0, 8)}`,
                            name: profile?.name || profile?.username || `User ${p.userId.slice(0, 8)}`,
                            profilePhoto: profile?.profilePhoto || null,
                            // ✅ CRITICAL FIX: Include role field from participant record
                            role: p.role as 'ADMIN' | 'MEMBER',
                            joinedAt: p.joinedAt instanceof Date ? p.joinedAt.toISOString() : (p.joinedAt as any),
                            isOnline: profile?.isOnline || false,
                            lastSeen: profile?.lastSeen || ""
                        };
                    }),
                    lastMessage: conv.lastMessage ? {
                        id: conv.lastMessage.id, // Include ID
                        content: conv.lastMessage.content,
                        type: conv.lastMessage.type, // ✅ FIX: Include message type for previews
                        status: conv.lastMessage.status, // Include status
                        senderId: conv.lastMessage.senderId,
                        senderName: (() => {
                            const profile = userProfilesMap.get(conv.lastMessage.senderId);
                            return profile?.name || profile?.username || 'Unknown';
                        })(),
                        createdAt: conv.lastMessage.createdAt
                    } : null,
                    lastMessageAt: conv.lastMessageAt,
                    unreadCount: conv.unreadCount,
                    isBlockedByMe,
                    isBlockedByThem,
                    createdAt: conv.createdAt
                };
            });

            // Only cache if we successfully enriched conversations
            if (enrichedConversations.length > 0) {
                await RedisCacheService.cacheUserConversationsWithMetadata(
                    query.userId,
                    query.limit,
                    query.offset,
                    enrichedConversations
                );
                logger.info("Cached enriched conversations", {
                    userId: query.userId,
                    count: enrichedConversations.length
                });
            }

            return enrichedConversations;
        } catch (error) {
            logger.error("Error in getUserConversationsWithMetadata service", {
                error: (error as Error).message,
                userId
            });
            throw error; // Re-throw to preserve business validation errors
        }
    }

    /**
     * Check if conversation exists between users 
     * Used for duplicate prevention before creating new conversation
     */
    async checkConversationExists(
        currentUserId: string,
        participantIds: string[]
    ): Promise<{ exists: boolean; conversationId?: string }> {
        try {
            // Create and validate query (business rules validated here)
            const query = new CheckConversationExistsQuery(currentUserId, participantIds);

            // Get all unique participant IDs
            const allParticipants = query.getAllParticipants();

            // Check if conversation exists
            const conversation = await this._chatRepository.conversationExists(allParticipants);

            const result = {
                exists: !!conversation,
                conversationId: conversation?.id
            };

            logger.info("Checked conversation existence", {
                currentUserId,
                participantIds,
                exists: result.exists,
                conversationId: result.conversationId
            });

            return result;
        } catch (error) {
            logger.error("Error in checkConversationExists service", {
                error: (error as Error).message,
                currentUserId,
                participantIds
            });
            throw error; // Re-throw to preserve business validation errors
        }
    }

    /**
     * Update message status using per-user receipt tracking + aggregation.
     * This replaces the old direct status mutation pattern.
     * Works for both 1-1 and group chats.
     */
    async updateMessageStatus(
        messageId: string,
        userId: string,
        status: 'DELIVERED' | 'READ'
    ): Promise<Message> {
        try {
            // 1. Write per-user receipt
            await this._chatRepository.updateMessageReceipt(messageId, userId, status);

            // 2. Aggregate: recompute root Message.status from receipt counts
            const updatedMessage = await this._chatRepository.aggregateMessageStatus(messageId);

            logger.info('Message receipt updated and status aggregated', { messageId, userId, status });
            return updatedMessage;
        } catch (error) {
            logger.error('Error updating message receipt', {
                error: (error as Error).message,
                messageId,
                userId,
                status,
            });
            throw new Error('Failed to update message status');
        }
    }

    /**
     * Mark all messages in a conversation as READ up to a certain message.
     * Per-user receipt model: records seenAt for userId on each relevant message,
     * then aggregates status on each message.
     */
    async markMessagesAsRead(
        conversationId: string,
        userId: string,
        lastReadMessageId: string
    ): Promise<void> {
        try {
            // Get the lastReadMessage to find its timestamp
            const lastReadMessage = await this._chatRepository.findMessageById(lastReadMessageId);

            if (!lastReadMessage || lastReadMessage.conversationId !== conversationId) {
                throw new Error('Invalid lastReadMessageId for this conversation');
            }

            // Update participant's lastReadAt timestamp (still used for unread count)
            await this._chatRepository.updateParticipantLastReadAt(
                conversationId,
                userId,
                new Date()
            );

            // Fetch all unread messages sent by others up to lastReadMessageId's timestamp
            const conversation = await this._chatRepository.findConversationById(conversationId);
            if (!conversation) throw new Error('Conversation not found');

            // Process messages up to lastReadMessageId's timestamp that haven't been read by this user.
            // This unifies 1-1 and Group chats to use the per-message receipt system,
            // which ensures real-time broadcasts and consistent aggregated states.
            const messagesToMark = await prisma.message.findMany({
                where: {
                    conversationId,
                    senderId: { not: userId },
                    createdAt: { lte: lastReadMessage.createdAt },
                    status: { notIn: ['READ'] as any }
                },
                select: { id: true, senderId: true }
            });

            // Process receipts in parallel (fire-and-forget per message)
            for (const msg of messagesToMark) {
                // Update the receipt and aggregate, then broadcast the new status via Redis
                this._chatRepository.updateMessageReceipt(msg.id, userId, 'READ')
                    .then(() => this._chatRepository.aggregateMessageStatus(msg.id))
                    .then((updatedMessage) => {
                        // Only broadcast if status actually changed to avoid noise
                        return redisPublisher.publish(
                            `chat:${conversationId}`,
                            JSON.stringify({
                                type: 'message_status_updated',
                                data: {
                                    messageId: updatedMessage.id,
                                    conversationId,
                                    status: updatedMessage.status,
                                    updatedBy: userId
                                }
                            })
                        );
                    })
                    .catch(err => {
                        logger.warn('Failed to update receipt or broadcast for message', { messageId: msg.id, error: err.message });
                    });
            }

            logger.info('Messages marked as read (per-user receipts)', {
                conversationId,
                userId,
                lastReadMessageId,
                affectedCount: messagesToMark.length
            });

            // ✅ FIX: Invalidate the user's conversation cache strictly so unreadCount resets to 0.
            // If we don't invalidate here, subsequent GET /conversations return stale data from Redis.
            await RedisCacheService.invalidateUserConversationsCache(userId);
            await RedisCacheService.invalidateUserConversationsMetadataCache(userId);

            // Also invalidate cache for senders whose messages were just marked as read
            const senderIdsSet = new Set(messagesToMark.map(m => m.senderId));
            for (const senderId of senderIdsSet) {
                await RedisCacheService.invalidateUserConversationsCache(senderId);
                await RedisCacheService.invalidateUserConversationsMetadataCache(senderId);
            }

        } catch (error) {
            logger.error('Error marking messages as read', {
                error: (error as Error).message,
                conversationId,
                userId,
                lastReadMessageId,
            });
            throw new Error('Failed to mark messages as read');
        }
    }

    /**
     * Delete a group conversation (owner only)
     */
    async deleteGroup(conversationId: string, userId: string): Promise<void> {
        try {
            // 1. Get conversation to check ownership and type
            const conversation = await this._chatRepository.findConversationById(conversationId);
            
            if (!conversation) {
                throw new Error("Conversation not found");
            }

            // 2. Verify it is a group
            if (conversation.type !== 'GROUP') {
                throw new Error("Cannot delete a direct message conversation");
            }

            // 3. Verify ownership
            if (conversation.ownerId !== userId) {
                throw new Error("Unauthorized: Only the group owner can delete the group");
            }

            // 4. Capture participants for broadcast before deletion
            const participantIds = conversation.participants.map(p => p.userId);

            // 5. Delete from DB
            await this._chatRepository.deleteConversation(conversationId);

            // 5b. Invalidate per-user conversation caches for ALL participants (including owner)
            // Without this, the owner's stale cache keeps showing the deleted group
            for (const participantId of participantIds) {
                await RedisCacheService.invalidateUserConversationsCache(participantId);
                await RedisCacheService.invalidateUserConversationsMetadataCache(participantId);
            }
            
            // 6. Broadcast group_deleted to all connected members via Redis pub/sub
            // Each socket-gateway subscriber will emit the event to connected clients
            // Using a shared channel for reliable multi-pod delivery
            const { redisPublisher } = await import('../../config/redis.config');
            
            if (redisPublisher) {
                await redisPublisher.publish(
                    'conversation_event',
                    JSON.stringify({
                        conversationId,
                        type: 'group_deleted',
                        targetUserIds: participantIds,
                        data: {
                            conversationId,
                            deletedBy: userId,
                            groupName: conversation.name
                        }
                    })
                );
            }

            // 7. Invalidate cache
            await RedisCacheService.invalidateConversationCache(conversationId);
            
            logger.info('Group deleted successfully', { conversationId, userId });
        } catch (error) {
            logger.error('Error deleting group', { 
                error: (error as Error).message, 
                conversationId, 
                userId 
            });
            throw error;
        }
    }
    
    /**
     * Get a single conversation with enriched metadata
     */
    async getConversationWithMetadata(conversationId: string, userId: string): Promise<ConversationWithMetadataDto | null> {
        try {
            // 1. Get conversation from DB
            const conversation = await this._chatRepository.findConversationById(conversationId);
            
            if (!conversation) return null;

            // 2. Verify user is a participant
            const isParticipant = conversation.participants.some(p => p.userId === userId);
            if (!isParticipant) {
               logger.warn(`User ${userId} attempted to access conversation ${conversationId} without being a participant`);
               return null; // Or throw specialized error
            }

            // 3. Collect participant IDs
            const participantIds = conversation.participants.map(p => p.userId);

            // 4. Fetch user profiles
            let userProfilesMap = new Map<string, any>();
            try {
                userProfilesMap = await authServiceClient.getUserProfiles(participantIds);
            } catch (error) {
                logger.error("Failed to fetch user profiles", { error: (error as Error).message });
            }

            // Fetch block relationships
            const blockOps = await this._chatRepository.getBlockRelationships(userId);
            const blockedByMe = new Set(blockOps.blockedByMe);
            const blockedMe = new Set(blockOps.blockedMe);
            const otherParticipant = conversation.type === 'DIRECT' 
                ? conversation.participants.find(p => p.userId !== userId)
                : null;
            const isBlockedByMe = otherParticipant ? blockedByMe.has(otherParticipant.userId) : false;
            const isBlockedByThem = otherParticipant ? blockedMe.has(otherParticipant.userId) : false;

            // 5. Build DTO
            const enrichedConversation: ConversationWithMetadataDto = {
                conversationId: conversation.id,
                type: conversation.type as 'DIRECT' | 'GROUP',
                name: conversation.name,
                icon: conversation.icon,
                description: conversation.description,
                ownerId: conversation.ownerId,
                onlyAdminsCanPost: conversation.onlyAdminsCanPost,
                onlyAdminsCanEditInfo: conversation.onlyAdminsCanEditInfo,
                participantIds: participantIds,
                participants: conversation.participants.map(p => {
                    const profile = userProfilesMap.get(p.userId);
                    return {
                        userId: p.userId,
                        username: profile?.username || `user_${p.userId.slice(0, 8)}`,
                        name: profile?.name || profile?.username || `User ${p.userId.slice(0, 8)}`,
                        profilePhoto: profile?.profilePhoto || null,
                        role: p.role as 'ADMIN' | 'MEMBER',
                        joinedAt: p.joinedAt instanceof Date ? p.joinedAt.toISOString() : (p.joinedAt as any),
                        isOnline: profile?.isOnline || false,
                        lastSeen: profile?.lastSeen || ""
                    };
                }),
                lastMessage: null, // Will fetch separately below
                lastMessageAt: conversation.lastMessageAt,
                unreadCount: 0, // Fetching single conversation, usually implies opening it, so unread count might be irrelevant or needs specific calculation logic if we want to show it before read
                isBlockedByMe,
                isBlockedByThem,
                createdAt: conversation.createdAt
            };

            // Fetch last message separately if needed
            try {
                const lastMsg = await this._chatRepository.getMessagesByConversationId(conversationId, userId, 1, 0);
                if (lastMsg && lastMsg.length > 0) {
                    const msg = lastMsg[0];
                    const senderProfile = userProfilesMap.get(msg.senderId);
                    enrichedConversation.lastMessage = {
                        id: msg.id,
                        content: msg.content,
                        type: msg.type,
                        status: msg.status,
                        senderId: msg.senderId,
                        senderName: senderProfile?.name || senderProfile?.username || 'Unknown',
                        createdAt: msg.createdAt
                    };
                }
            } catch (error) {
                logger.warn("Failed to fetch last message for conversation", { conversationId, error: (error as Error).message });
            }
            
            // Calculate unread count for this user
            const userParticipant = conversation.participants.find(p => p.userId === userId);
            if (userParticipant && userParticipant.lastReadAt) {
                 // ideally repo method to count messages after lastReadAt
                 // simplified: set to 0 as we are likely opening it
                 // or leave as 0
            }

            return enrichedConversation;

        } catch (error) {
            logger.error("Error in getConversationWithMetadata", { error: (error as Error).message });
            throw error;
        }
    }
    // --- Message Actions ---

    async editMessage(messageId: string, userId: string, newContent: string): Promise<Message> {
        return this._chatActionService.editMessage(messageId, userId, newContent);
    }

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        return this._chatActionService.deleteMessage(messageId, userId);
    }

    async deleteMessageForMe(messageId: string, userId: string): Promise<void> {
        return this._chatActionService.deleteMessageForMe(messageId, userId);
    }

    async replyToMessage(senderId: string, conversationId: string, content: string, replyToId: string, dedupeId?: string): Promise<Message> {
        return this.sendMessage(senderId, [], content, 'TEXT', undefined, undefined, undefined, undefined, undefined, undefined, conversationId, dedupeId, replyToId);
    }

    async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        return this._chatActionService.addReaction(messageId, userId, emoji);
    }

    async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        return this._chatActionService.removeReaction(messageId, userId, emoji);
    }

    async pinMessage(messageId: string, userId: string): Promise<void> {
        return this._chatActionService.pinMessage(messageId, userId);
    }

    async unpinMessage(messageId: string, userId: string): Promise<void> {
        return this._chatActionService.unpinMessage(messageId, userId);
    }

    async getPinnedMessages(conversationId: string, userId: string): Promise<Message[]> {
        return this._chatActionService.getPinnedMessages(conversationId, userId);
    }

    async forwardMessage(messageIds: string[], targetConversationIds: string[], userId: string): Promise<MessageResponseDto[]> {
        // Business logic: Forward multiple messages to one or more targets
        const forwardedMessages: MessageResponseDto[] = [];

        for (const messageId of messageIds) {
            const originalMessage = await this._chatRepository.findMessageById(messageId);
            if (!originalMessage) {
                logger.warn("Attempted to forward non-existent message", { messageId });
                continue;
            }

            for (const targetId of targetConversationIds) {
                // Determine if targetId is a conversation or a user
                let conversationId: string | undefined = undefined;
                let recipientIds: string[] = [];

                const conversation = await this._chatRepository.findConversationById(targetId);
                if (conversation) {
                    conversationId = targetId;
                } else {
                    // Treat as userId
                    recipientIds = [targetId];
                }

                // Forward the message
                const newMessage = await this.sendMessage(
                    userId,
                    recipientIds, 
                    originalMessage.content,
                    originalMessage.type,
                    originalMessage.mediaUrl || undefined,
                    originalMessage.mediaId || undefined,
                    originalMessage.mediaMimeType || undefined,
                    originalMessage.mediaSize || undefined,
                    originalMessage.mediaName || undefined,
                    originalMessage.mediaDuration || undefined,
                    conversationId,
                    undefined, // dedupeId
                    undefined, // replyToId
                    true,      // isForwarded
                    originalMessage.senderId,
                    originalMessage.id
                );

                forwardedMessages.push(MessageMapper.toResponseDto(newMessage));
            }
        }
        return forwardedMessages;
    }


    async blockUser(userId: string, targetUserId: string): Promise<void> {
        return this._chatActionService.blockUser(userId, targetUserId);
    }

    async unblockUser(userId: string, targetUserId: string): Promise<void> {
        return this._chatActionService.unblockUser(userId, targetUserId);
    }

    async getBlockedUsers(userId: string): Promise<any[]> {
        return this._chatActionService.getBlockedUsers(userId);
    }

    async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
        return this._chatActionService.isUserBlocked(userId, targetUserId);
    }

    async getSharedMedia(
        conversationId: string, 
        userId: string, 
        types: string[], 
        limit: number, 
        offset: number
    ): Promise<Message[]> {
        try {
            // Verify user is a participant
            const conversation = await this._chatRepository.findConversationById(conversationId);
            if (!conversation) {
                throw new Error("Conversation not found");
            }

            const isParticipant = conversation.participants.some(p => p.userId === userId);
            if (!isParticipant) {
                throw new Error("User is not a participant of this conversation");
            }

            return await this._chatRepository.getMessagesByType(conversationId, userId, types, limit, offset);
        } catch (error) {
            logger.error("Error getting shared media", { error: (error as Error).message });
            throw error;
        }
    }

    async getCommonGroups(userId: string, targetUserId: string): Promise<Conversation[]> {
        try {
            return await this._chatRepository.getCommonGroups(userId, targetUserId);
        } catch (error) {
            logger.error("Error getting common groups", { error: (error as Error).message });
            throw error;
        }
    }

    async softDeleteConversation(conversationId: string, userId: string): Promise<void> {
        try {
            await this._chatRepository.softDeleteConversation(conversationId, userId);
            // Invalidate caches
            await RedisCacheService.invalidateUserConversationsMetadataCache(userId);
            await RedisCacheService.invalidateConversationCache(conversationId);
        } catch (error) {
            logger.error("Error soft deleting conversation", { error: (error as Error).message });
            throw error;
        }
    }

    async clearChatHistory(conversationId: string, userId: string): Promise<void> {
        try {
            await this._chatRepository.clearChatHistory(conversationId, userId);
            // Invalidate message cache
            await RedisCacheService.invalidateConversationCache(conversationId);
        } catch (error) {
            logger.error("Error clearing chat history", { error: (error as Error).message });
            throw error;
        }
    }

    async searchMessages(conversationId: string, userId: string, query: string): Promise<Message[]> {
        try {
            // Verify user is a participant
            const conversation = await this._chatRepository.findConversationById(conversationId);
            if (!conversation) {
                throw new Error("Conversation not found");
            }

            const isParticipant = conversation.participants.some(p => p.userId === userId);
            if (!isParticipant) {
                throw new Error("User is not a participant of this conversation");
            }

            return await this._chatRepository.searchMessages(conversationId, userId, query);
        } catch (error) {
            logger.error("Error searching messages", { error: (error as Error).message });
            throw error;
        }
    }

    async getConversationLinks(
        conversationId: string, 
        userId: string, 
        limit: number, 
        offset: number
    ): Promise<any[]> {
        try {
            // Verify user is a participant
            const conversation = await this._chatRepository.findConversationById(conversationId);
            if (!conversation) {
                throw new Error("Conversation not found");
            }

            const isParticipant = conversation.participants.some(p => p.userId === userId);
            if (!isParticipant) {
                throw new Error("User is not a participant of this conversation");
            }

            return await this._chatRepository.getConversationLinks(conversationId, limit, offset);
        } catch (error) {
            logger.error("Error getting conversation links", { error: (error as Error).message });
            throw error;
        }
    }
}
