import { IChatService } from "../interfaces/IChatService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Message, Conversation, Prisma, Participant } from "@prisma/client";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { authServiceClient } from "../../clients/auth-service.client";
import {
    SendMessageCommand,
    CreateConversationCommand,
    GetMessagesQuery,
    GetUserConversationsQuery,
    GetUserConversationsWithMetadataQuery,
    CheckConversationExistsQuery,
    ConversationWithMetadataDto
} from "../../dtos/chat-service.dto";

export class ChatService implements IChatService {

    constructor(private _chatRepository: IChatRepository) { }

    /**
     * Send a message (uses Command pattern with business validation)
     * Invalidates cache after sending
     */
    async sendMessage(
        senderId: string, 
        recipientIds: string[], 
        content: string,
        // Optional media params
        messageType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' = 'TEXT',
        mediaUrl?: string,
        mediaId?: string,
        mediaMimeType?: string,
        mediaSize?: number,
        mediaName?: string,
        mediaDuration?: number,
        conversationId?: string,
        dedupeId?: string
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
                dedupeId
            );

            let conversation;

            // 1. Try to find by conversationId first (Primary strategy)
            if (command.conversationId) {
                conversation = await this._chatRepository.findConversationById(command.conversationId);
                
                if (!conversation) {
                    logger.warn(`Conversation ID ${command.conversationId} not found, falling back to participant lookup`);
                } else {
                    // Check if sender is participant
                    const isParticipant = conversation.participants.some(p => p.userId === command.senderId);
                    if (!isParticipant) {
                        throw new Error("Sender is not a participant in this conversation");
                    }
                }
            }

            // 2. Fallback: Find or create by participants
            if (!conversation) {
                if (!command.recipientIds || command.recipientIds.length === 0) {
                     logger.error("Missing recipients and invalid conversation ID", { senderId: command.senderId });
                     throw new Error("Cannot send message: Recipient IDs required if conversation ID is missing/invalid");
                }
                const participantIds = [command.senderId, ...command.recipientIds];
                conversation = await this._chatRepository.findOrCreateConversation(participantIds);
            }

            // Create message data
            const messageData: Prisma.MessageCreateInput = {
                senderId: command.senderId,
                content: command.content,
                // Media fields
                type: command.messageType,
                mediaUrl: command.mediaUrl,
                mediaId: command.mediaId,
                mediaMimeType: command.mediaMimeType,
                mediaSize: command.mediaSize,
                mediaName: command.mediaName,
                mediaDuration: command.mediaDuration,
                dedupeId: command.dedupeId,
                conversation: {
                    connect: {
                        id: conversation.id
                    }
                }
            };

            // Create the message
            const message = await this._chatRepository.createMessage(messageData);

            // Update conversation's last message timestamp
            await this._chatRepository.updateLastMessageAt(conversation.id, new Date());

            // Invalidate cache for this conversation and all participants
            await RedisCacheService.invalidateConversationCache(conversation.id);
            
            const participantIds = conversation.participants.map(p => p.userId);
            for (const participantId of participantIds) {
                await RedisCacheService.invalidateUserConversationsCache(participantId);
                // Also invalidate the enriched metadata cache
                await RedisCacheService.invalidateUserConversationsMetadataCache(participantId);
            }

            logger.info("Message sent successfully", {
                messageId: message.id,
                conversationId: conversation.id,
                senderId: command.senderId
            });

            return message;
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
            const conversation = await this._chatRepository.findConversationById(conversationId);

            if (!conversation) {
                throw new Error("Conversation not found");
            }

            const isParticipant = conversation.participants.some(
                (p: Participant) => p.userId === userId
            );

            if (!isParticipant) {
                throw new Error("Unauthorized: User is not a participant in this conversation");
            }

            // Get messages from database using offset-based pagination
            // Get messages from database using cursor or offset
            const messages = await this._chatRepository.getMessagesByConversationId(
                conversationId,
                safeLimit,
                offset,
                before
            );

            logger.info("Retrieved conversation messages from DB", {
                conversationId,
                userId,
                messageCount: messages.length,
                offset
            });

            return messages;
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
                participantIds: allParticipants,
                participants: allParticipants.map(userId => {
                    const profile = userProfilesMap.get(userId);
                    return {
                        userId,
                        username: profile?.username || 'unknown',
                        name: profile?.name || 'Unknown User',
                        profilePhoto: profile?.profilePhoto || null
                    };
                }),
                lastMessage: null,
                lastMessageAt: conversation.createdAt,
                unreadCount: 0
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

            if (!conversation) {
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

                // If gRPC failed and returned empty profiles, log warning but continue
                if (allParticipantIds.size > 0 && userProfilesMap.size === 0) {
                    logger.error("gRPC returned no profiles despite having participant IDs", {
                        expectedProfiles: allParticipantIds.size,
                        conversationCount: conversationsWithMetadata.length
                    });
                    // Return empty array and don't cache - indicates a system issue
                    return [];
                }
            } catch (error) {
                logger.error("Failed to fetch user profiles from gRPC", {
                    error: (error as Error).message,
                    participantCount: allParticipantIds.size
                });
                // Return empty array and don't cache - indicates a system issue
                return [];
            }

            // Map to enriched DTOs with user profile data
            const enrichedConversations: ConversationWithMetadataDto[] = conversationsWithMetadata.map((conv) => {
                return {
                    conversationId: conv.id,
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
                            username: profile?.username || 'unknown',
                            name: profile?.name || 'Unknown User',
                            profilePhoto: profile?.profilePhoto || null
                        };
                    }),
                    lastMessage: conv.lastMessage ? {
                        content: conv.lastMessage.content,
                        senderId: conv.lastMessage.senderId,
                        senderName: userProfilesMap.get(conv.lastMessage.senderId)?.name || 'Unknown',
                        createdAt: conv.lastMessage.createdAt
                    } : null,
                    lastMessageAt: conv.lastMessageAt,
                    unreadCount: conv.unreadCount
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
     * Update message status to DELIVERED or READ
     * Used by WebSocket handlers for delivery acknowledgments
     */
    async updateMessageStatus(
        messageId: string,
        status: 'DELIVERED' | 'READ'
    ): Promise<Message> {
        try {
            const updateData: Prisma.MessageUpdateInput = {
                status,
                ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
                ...(status === 'READ' && { readAt: new Date() }),
            };

            const updatedMessage = await this._chatRepository.updateMessage(messageId, updateData);

            logger.info('Message status updated', { messageId, status });
            return updatedMessage;
        } catch (error) {
            logger.error('Error updating message status', {
                error: (error as Error).message,
                messageId,
                status,
            });
            throw new Error('Failed to update message status');
        }
    }

    /**
     * Mark all messages in a conversation as READ up to a certain message
     * Used for read receipts (WhatsApp-style)
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

            // Mark all messages before this timestamp as READ (excluding sender's own messages)
            await this._chatRepository.markMessagesAsReadBefore(
                conversationId,
                userId,
                lastReadMessage.createdAt
            );

            // Update participant's lastReadAt timestamp
            await this._chatRepository.updateParticipantLastReadAt(
                conversationId,
                userId,
                new Date()
            );

            logger.info('Messages marked as read', {
                conversationId,
                userId,
                lastReadMessageId,
            });
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
}

