import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Message, Prisma, GroupRole } from "@prisma/client";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { SendMessageCommand } from "../../dtos/chat-service.dto";
import { getProducer } from "../../utils/kafka.util";
import { redisPublisher } from "../../config/redis.config";
import { MessageMapper } from "../../mappers/chat.mapper";
import { createCircuitBreaker } from "../../utils/circuit.breaker.util";
import CircuitBreaker from "opossum";
import { AppError } from "../../utils/AppError";

export class MessageSagaService {
    private _redisBreaker: CircuitBreaker<[string, string], number>;
    private _kafkaBreaker: CircuitBreaker<[any], void>;

    constructor(private _chatRepository: IChatRepository) {
        // Initialize Circuit Breakers
        // Redis: Fail fast (3s), retry fast (10s) - Critical for real-time feel
        this._redisBreaker = createCircuitBreaker(
            this._publishToRedis.bind(this),
            "redis-publish-message",
            { timeout: 3000, resetTimeout: 10000 }
        );

        // Kafka: Standard timeouts - Background reliability
        this._kafkaBreaker = createCircuitBreaker(
            this._publishToKafka.bind(this),
            "kafka-publish-event",
            { timeout: 5000, resetTimeout: 30000 }
        );
    }

    /**
     * Helper to publish to Redis (wrapped by Breaker)
     */
    private async _publishToRedis(channel: string, message: string): Promise<number> {
        if (!redisPublisher.isOpen) {
            throw new Error("Redis connection is closed");
        }
        return await redisPublisher.publish(channel, message);
    }

    /**
     * Helper to publish to Kafka (wrapped by Breaker)
     */
    private async _publishToKafka(payload: any): Promise<void> {
        const producer = await getProducer();
        await producer.send(payload);
    }

    /**
     * The Saga: Validate -> Support -> Broadcast -> Event
     */
    async sendMessage(command: SendMessageCommand): Promise<Message> {
        logger.info("👉 [DEBUG] Saga Started", { command: JSON.stringify(command) });

        try {
            // 1. Validation & Conversation Resolution Logic
            let conversation;

            // ✅ CRITICAL FIX: Prioritize conversationId if provided (Trusted Source)
            if (command.conversationId) {
                logger.info("👉 [DEBUG] Resolving by ID", { conversationId: command.conversationId });
                conversation = await this._chatRepository.findConversationById(command.conversationId);
                
                if (!conversation) {
                    logger.warn("Conversation ID provided but not found, falling back to findOrCreate", { conversationId: command.conversationId });
                } else {
                    // Verify sender is a participant
                    const senderParticipant = conversation.participants.find(p => p.userId === command.senderId);
                    if (!senderParticipant) {
                         throw new Error("Sender is not a participant in this conversation");
                    }

                    // Verify posting permissions for groups
                    if (conversation.type === 'GROUP') {
                        // ✅ SUSPENSION CHECK: Prevent messaging in suspended hubs
                        if (conversation.isSuspended) {
                            throw new AppError("This hub is currently suspended by an admin.", 403);
                        }

                        if (conversation.onlyAdminsCanPost) {
                            if (senderParticipant.role !== GroupRole.ADMIN && conversation.ownerId !== command.senderId) {
                                 throw new AppError("Only admins can send messages in this group", 403);
                            }
                        }
                    }
                }
            }

            // Fallback: If no ID or not found, find or create by participants
            if (!conversation) {
                if (command.recipientIds.length === 0) {
                     logger.error("Invalid conversation ID and no recipients provided", { conversationId: command.conversationId });
                     throw new Error("Invalid conversation ID and no recipients provided");
                }
                const participantIds = [command.senderId, ...command.recipientIds];
                conversation = await this._chatRepository.findOrCreateConversation(participantIds);
            }

            // ✅ BLOCK CHECK: Prevent messaging if blocked (Direct Chats Only)
            if (conversation.type === 'DIRECT') {
                const otherParticipant = conversation.participants.find(p => p.userId !== command.senderId);
                if (otherParticipant) {
                    const isBlocked = await this._chatRepository.isUserBlocked(command.senderId, otherParticipant.userId);
                    if (isBlocked) {
                        logger.warn("🚫 Message blocked", { 
                            senderId: command.senderId, 
                            recipientId: otherParticipant.userId, 
                            conversationId: conversation.id 
                        });
                        throw new AppError("You cannot send messages to this user.", 403);
                    }
                }
            }

            // 2. Persistence Logic (DB)
            // Use Mapper to convert Domain Command -> Persistence DTO
            // Get recipient IDs (all participants except sender)
            const recipientIds = conversation.participants
                .filter(p => p.userId !== command.senderId && !p.deletedAt)
                .map(p => p.userId);

            const messageData = MessageMapper.toPersistence(command, conversation.id);
            // Snapshot expectedRecipientCount at send time for correct group aggregation
            // For 1-1 this is 1; for groups it is N-1 (sender excluded)
            (messageData as any).expectedRecipientCount = recipientIds.length;

            logger.info("👉 [DEBUG] Persisting Message Data", { data: JSON.stringify(messageData) });

            const message = await this._chatRepository.createMessage(messageData);
            logger.info("👉 [DEBUG] Message Persisted", { messageId: message.id });

            // Create per-user receipt rows for all recipients (sender excluded)
            // This allows proper aggregation of DELIVERED / READ status
            if (recipientIds.length > 0) {
                this._chatRepository.createMessageReceipts(message.id, recipientIds).catch(err => {
                    logger.warn("Failed to create message receipts", { messageId: message.id, error: err.message });
                });
            }

            await this._chatRepository.updateLastMessageAt(conversation.id, new Date());

            // 3. Cache Invalidation
            // Invalidate the conversation's message cache
            await RedisCacheService.invalidateConversationCache(conversation.id);
            
            // ✅ CRITICAL: Invalidate the conversation LIST cache for ALL participants
            // This ensures the sidebar/chat list updates and reorders immediately
            const allParticipantIds = conversation.participants.map(p => p.userId);
            await Promise.all(
                allParticipantIds.map(userId => 
                    RedisCacheService.invalidateUserConversationsMetadataCache(userId)
                )
            );

            // 4. Redis Broadcast (Immediate Delivery) - Protected by Circuit Breaker
            // Use Mapper to ensure payload matches REST API response shape exactly
            const messageDto = MessageMapper.toResponseDto(message);
            
            const redisPayload = JSON.stringify({
                type: 'new_message',
                data: {
                    ...messageDto,
                    dedupeId: command.dedupeId // Ensure dedupeId is present (though DTO has it)
                },
                targetUserIds: allParticipantIds // Include targets for direct WebSocket delivery
            });

            logger.info("👉 [DEBUG] Broadcasting to Redis", { 
                channel: `chat:${conversation.id}`, 
                dedupeId: command.dedupeId 
            });

            this._redisBreaker.fire(`chat:${conversation.id}`, redisPayload).catch(err => {
                logger.warn("Redis Broadcast Failed (Circuit Breaker)", { error: err.message });
            });

            // Get recipient IDs for Kafka event (already computed above)
            this._kafkaBreaker.fire({
                topic: 'chat-events',
                messages: [{
                    key: conversation.id,
                    value: JSON.stringify({
                        event: 'MessageSent',
                        messageId: message.id,
                        senderId: message.senderId,
                        conversationId: conversation.id,
                        content: message.content, // Notification service needs this
                        type: message.type, // ✅ For better notification text
                        timestamp: message.createdAt,
                        recipientIds: recipientIds, // ✅ Include recipients for notification service
                        replyToId: message.replyToId, // ✅ Support for reply notifications
                        replyToUserId: (message as any).replyTo?.senderId // ✅ Direct access to reply target
                    })
                }]

            }).catch(err => {
                logger.warn("Kafka Event Publish Failed (Circuit Breaker)", { error: err.message });
            });

            logger.info("👉 [DEBUG] Message Saga Completed", { messageId: message.id });

            // 6. Link Extraction (Background)
            if (message.content) {
                this._extractLinks(message.id, message.content).catch(err => {
                    logger.warn("Link extraction failed", { messageId: message.id, error: err.message });
                });
            }

            return message;

        } catch (error) {
            logger.error("Message Saga Failed", { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Specialized method for system messages (broadcasts to whole group)
     */
    async sendSystemMessage(conversationId: string, content: string, senderId: string): Promise<Message> {
        logger.info("👉 [DEBUG] Sending System Message", { conversationId, content, senderId });
        
        try {
            const conversation = await this._chatRepository.findConversationById(conversationId);
            if (!conversation) throw new Error("Conversation not found");

            const participantIds = conversation.participants
                .filter(p => !p.deletedAt)
                .map(p => p.userId);

            const recipientIds = participantIds.filter(id => id !== senderId);

            const message = await this._chatRepository.createMessage({
                conversation: { connect: { id: conversationId } },
                senderId,
                content,
                type: 'SYSTEM',
                status: 'SENT',
                expectedRecipientCount: recipientIds.length
            });

            // Fast receipt creation
            if (recipientIds.length > 0) {
                this._chatRepository.createMessageReceipts(message.id, recipientIds).catch(err => {
                    logger.warn("Failed to create system message receipts", { messageId: message.id, error: err.message });
                });
            }

            await this._chatRepository.updateLastMessageAt(conversationId, new Date());

            // Invalidate Caches (Non-blocking)
            RedisCacheService.invalidateConversationCache(conversationId).catch(err => {
                logger.warn("Failed to invalidate conversation cache", { error: err.message });
            });
            
            participantIds.forEach(userId => {
                 RedisCacheService.invalidateUserConversationsMetadataCache(userId).catch(err => {
                     logger.debug("Failed to invalidate user metadata cache", { userId, error: err.message });
                 });
            });

            // Redis Broadcast
            const messageDto = MessageMapper.toResponseDto(message);
            const redisPayload = JSON.stringify({
                type: 'new_message',
                data: messageDto,
                targetUserIds: participantIds // Include targets for direct WebSocket delivery
            });

            this._redisBreaker.fire(`chat:${conversationId}`, redisPayload).catch(err => {
                logger.warn("Redis System Broadcast Failed", { error: err.message });
            });

            // Kafka Event
            this._kafkaBreaker.fire({
                topic: 'chat-events',
                messages: [{
                    key: conversationId,
                    value: JSON.stringify({
                        event: 'MessageSent',
                        messageId: message.id,
                        senderId,
                        conversationId,
                        content,
                        timestamp: message.createdAt,
                        recipientIds: recipientIds
                    })
                }]
            }).catch(err => {
                logger.warn("Kafka System Event Failed", { error: err.message });
            });

            return message;
        } catch (error) {
            logger.error("Failed to send system message", { error: (error as Error).message });
            throw error;
        }
    }

    /**
     * Extracts URLs from message content and saves them to the repository
     */
    private async _extractLinks(messageId: string, content: string): Promise<void> {
        // Simple regex for URL extraction
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = content.match(urlRegex);

        if (urls && urls.length > 0) {
            // Remove duplicates and clean URLs
            const uniqueUrls = Array.from(new Set(urls.map(url => url.replace(/[.,!?;:]+$/, ''))));
            await this._chatRepository.saveMessageLinks(messageId, uniqueUrls);
            logger.info("Links extracted and saved", { messageId, count: uniqueUrls.length });
        }
    }
}
