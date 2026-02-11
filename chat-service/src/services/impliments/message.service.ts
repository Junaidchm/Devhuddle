import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Message, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { SendMessageCommand } from "../../dtos/chat-service.dto";
import { getProducer } from "../../utils/kafka.util";
import { redisPublisher } from "../../config/redis.config";
import { MessageMapper } from "../../mappers/chat.mapper";
import { createCircuitBreaker } from "../../utils/circuit.breaker.util";
import CircuitBreaker from "opossum";

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
                    const isParticipant = conversation.participants.some(p => p.userId === command.senderId);
                    if (!isParticipant) {
                         throw new Error("Sender is not a participant in this conversation");
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

            // 2. Persistence Logic (DB)
            // Use Mapper to convert Domain Command -> Persistence DTO
            const messageData = MessageMapper.toPersistence(command, conversation.id);
            logger.info("👉 [DEBUG] Persisting Message Data", { data: JSON.stringify(messageData) });

            const message = await this._chatRepository.createMessage(messageData);
            logger.info("👉 [DEBUG] Message Persisted", { messageId: message.id });

            await this._chatRepository.updateLastMessageAt(conversation.id, new Date());

            // 3. Cache Invalidation
            await RedisCacheService.invalidateConversationCache(conversation.id);

            // 4. Redis Broadcast (Immediate Delivery) - Protected by Circuit Breaker
            // If Redis is down, we switch to fallback (log warn) but DO NOT fail the request.
            // The user still sees the message as "Sent" (saved to DB).
            const redisPayload = JSON.stringify({
                type: 'new_message',
                data: {
                    ...message,
                    dedupeId: command.dedupeId // ✅ Pass dedupeId back to frontend
                }
            });

            logger.info("👉 [DEBUG] Broadcasting to Redis", { 
                channel: `chat:${conversation.id}`, 
                dedupeId: command.dedupeId 
            });

            this._redisBreaker.fire(`chat:${conversation.id}`, redisPayload).catch(err => {
                logger.warn("Redis Broadcast Failed (Circuit Breaker)", { error: err.message });
            });

            // 5. Kafka Event (Async Reliability) - Protected by Circuit Breaker
            // If Kafka is down, we switch to fallback (log warn). 
            // Ideally, we should push to a local Dead Letter Queue (DLQ) file/table here.
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
                        timestamp: message.createdAt
                    })
                }]
            }).catch(err => {
                logger.warn("Kafka Event Publish Failed (Circuit Breaker)", { error: err.message });
            });

            logger.info("Message Saga Completed", { messageId: message.id });
            return message;

        } catch (error) {
            logger.error("Message Saga Failed", { error: (error as Error).message });
            throw error;
        }
    }
}
