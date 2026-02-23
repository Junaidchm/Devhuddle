import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import logger from "../../utils/logger.util";
import { redisPublisher } from "../../config/redis.config";
import { getProducer } from "../../utils/kafka.util";
import { AppError } from "../../utils/AppError";
import { Message, GroupRole, BlockedUser } from "@prisma/client";
import { RedisCacheService } from "../../utils/redis-cache.util";

export class ChatActionService {
    constructor(private _chatRepository: IChatRepository) {}

    private async _publishToRedis(channel: string, message: any): Promise<void> {
        if (redisPublisher.isOpen) {
            await redisPublisher.publish(channel, JSON.stringify(message));
        }
    }

    private async _publishToKafka(topic: string, payload: any): Promise<void> {
        try {
            const producer = await getProducer();
            await producer.send({
                topic,
                messages: [{ value: JSON.stringify(payload) }]
            });
        } catch (error) {
            logger.error(`Failed to publish to Kafka topic ${topic}`, { error });
            // Non-fatal, proceed
        }
    }

    async editMessage(messageId: string, userId: string, newContent: string): Promise<Message> {
        const message = await this._chatRepository.findMessageWithContext(messageId);

        if (!message) throw new AppError("Message not found", 404);
        if (message.senderId !== userId) throw new AppError("You can only edit your own messages", 403);

        const updatedMessage = await this._chatRepository.editMessage(messageId, newContent);

        await this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'message_updated',
            data: updatedMessage
        });

        return updatedMessage;
    }

    async deleteMessage(messageId: string, userId: string): Promise<void> {
        const message = await this._chatRepository.findMessageWithContext(messageId);

        if (!message) throw new AppError("Message not found", 404);
        if (message.senderId !== userId) throw new AppError("You can only delete your own messages", 403);

        await this._chatRepository.deleteMessage(messageId);

        await this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'message_deleted',
            data: { 
                messageId, 
                conversationId: message.conversationId,
                deleteForEveryone: true 
            }
        });
    }

    async deleteMessageForMe(messageId: string, userId: string): Promise<void> {
        const message = await this._chatRepository.findMessageById(messageId);
        if (!message) throw new AppError("Message not found", 404);

        await this._chatRepository.deleteMessageForMe(messageId, userId);
        
        // No broadcast needed, client filters locally or re-fetches
    }

    async addReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        const message = await this._chatRepository.findMessageWithContext(messageId);
        if (!message) throw new AppError("Message not found", 404);

        if (message.conversation.type === 'DIRECT') {
            const otherParticipant = message.conversation.participants.find(p => p.userId !== userId);
            if (otherParticipant) {
                const isBlocked = await this._chatRepository.isUserBlocked(userId, otherParticipant.userId);
                if (isBlocked) throw new AppError("You cannot react to messages from this user.", 403);
            }
        }

        // 1. Check for existing reaction by this user on this message
        const existingReaction = await this._chatRepository.getUserReactionOnMessage(messageId, userId);

        if (existingReaction) {
            // 2. If same emoji, toggle off (remove)
            if (existingReaction.emoji === emoji) {
                await this._chatRepository.removeReaction(messageId, userId, emoji);
                await this._publishToRedis(`chat:${message.conversationId}`, {
                    type: 'reaction_removed',
                    conversationId: message.conversationId,
                    data: { messageId, userId, emoji }
                });
                return;
            } else {
                // 3. If different emoji, remove old one first (one-reaction rule)
                await this._chatRepository.removeReaction(messageId, userId, existingReaction.emoji);
                await this._publishToRedis(`chat:${message.conversationId}`, {
                    type: 'reaction_removed',
                    conversationId: message.conversationId,
                    data: { messageId, userId, emoji: existingReaction.emoji }
                });
            }
        }

        // 4. Add the new reaction
        await this._chatRepository.addReaction(messageId, userId, emoji);

        await this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'reaction_added',
            conversationId: message.conversationId,
            data: { messageId, userId, emoji }
        });
    }

    async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
        const message = await this._chatRepository.findMessageWithContext(messageId);
        if (!message) throw new AppError("Message not found", 404);

        await this._chatRepository.removeReaction(messageId, userId, emoji);

        await this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'reaction_removed',
            conversationId: message.conversationId,
            data: { messageId, userId, emoji }
        });
    }

    async pinMessage(messageId: string, userId: string): Promise<void> {
        logger.info("[ChatActionService] pinMessage called", { messageId, userId });
        const message = await this._chatRepository.findMessageWithContext(messageId);

        if (!message) throw new AppError("Message not found", 404);

        // Permission check
        const participant = message.conversation.participants.find(p => p.userId === userId);
        if (!participant) throw new AppError("Not a participant", 403);

        // Group Admin check if needed
        if (message.conversation.type === 'GROUP' && message.conversation.onlyAdminsCanEditInfo) {
             if (participant.role !== GroupRole.ADMIN) {
                 throw new AppError("Only admins can pin messages", 403);
             }
        }
        
        logger.info("[ChatActionService] Updating message isPinned=true", { messageId });
        const updatedMessage = await this._chatRepository.pinMessage(messageId, userId);
        logger.info("[ChatActionService] Message updated, publishing to Redis", { messageId });

        // Fire-and-forget or timeout Redis to prevent blocking response
        this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'message_pinned',
            data: updatedMessage
        }).catch(err => {
            logger.error("[ChatActionService] Failed to publish pin event to Redis", { error: err.message, messageId });
        });
        
        logger.info("[ChatActionService] pinMessage completed", { messageId });
    }

    async unpinMessage(messageId: string, userId: string): Promise<void> {
        logger.info("[ChatActionService] unpinMessage called", { messageId, userId });
        const message = await this._chatRepository.findMessageWithContext(messageId);

        if (!message) throw new AppError("Message not found", 404);

        const participant = message.conversation.participants.find(p => p.userId === userId);
         if (!participant) throw new AppError("Not a participant", 403);

         if (message.conversation.type === 'GROUP' && message.conversation.onlyAdminsCanEditInfo) {
             if (participant.role !== GroupRole.ADMIN) {
                 throw new AppError("Only admins can unpin messages", 403);
             }
        }

        logger.info("[ChatActionService] Updating message isPinned=false", { messageId });
        await this._chatRepository.unpinMessage(messageId);
        logger.info("[ChatActionService] Message updated, publishing unpin to Redis", { messageId });

        this._publishToRedis(`chat:${message.conversationId}`, {
            type: 'message_unpinned',
            data: { messageId }
        }).catch(err => {
             logger.error("[ChatActionService] Failed to publish unpin event to Redis", { error: err.message, messageId });
        });
        
        logger.info("[ChatActionService] unpinMessage completed", { messageId });
    }
    
    async getPinnedMessages(conversationId: string, userId: string): Promise<Message[]> {
         // Verify participation (using helper from repository)
         const participant = await this._chatRepository.findParticipantInConversation(userId, conversationId);
         if (!participant) throw new AppError("Not a participant", 403);

         return await this._chatRepository.getPinnedMessages(conversationId, userId);
    }

    async forwardMessage(messageId: string, targetConversationIds: string[], userId: string): Promise<void> {
        const originalMessage = await this._chatRepository.findMessageById(messageId);
        if (!originalMessage) throw new AppError("Original message not found", 404);

        // Logic placeholder
    }


    async blockUser(userId: string, targetUserId: string): Promise<void> {
        if (userId === targetUserId) throw new AppError("Cannot block yourself", 400);

        await this._chatRepository.blockUser(userId, targetUserId);
        
        // Invalidate conversation list cache for both users
        await Promise.all([
            RedisCacheService.invalidateUserConversationsMetadataCache(userId),
            RedisCacheService.invalidateUserConversationsMetadataCache(targetUserId)
        ]).catch(err => logger.error("Failed to invalidate cache after block", err));

        // Find existing direct conversation if any
        const conversation = await this._chatRepository.findOrCreateConversation([userId, targetUserId]);
        if (conversation && conversation.type === 'DIRECT') {


            // Create ONE new SYSTEM message for this block event
            const systemMessage = await this._chatRepository.createMessage({
                conversation: { connect: { id: conversation.id } },
                senderId: userId,
                content: 'blocked',   // Short canonical key — frontend maps to display text
                type: 'SYSTEM',
                status: 'SENT'
            });
            
            // Broadcast to both users
            this._publishToRedis(`chat:${conversation.id}`, {
                type: 'USER_BLOCKED',
                data: {
                    conversationId: conversation.id,
                    blockerId: userId,
                    blockedId: targetUserId,
                    systemMessage
                }
            }).catch(err => logger.error("Failed to publish USER_BLOCKED", err));
        }
    }

    async unblockUser(userId: string, targetUserId: string): Promise<void> {
        await this._chatRepository.unblockUser(userId, targetUserId);
        
        // Invalidate conversation list cache for both users
        await Promise.all([
            RedisCacheService.invalidateUserConversationsMetadataCache(userId),
            RedisCacheService.invalidateUserConversationsMetadataCache(targetUserId)
        ]).catch(err => logger.error("Failed to invalidate cache after unblock", err));

        const conversation = await this._chatRepository.findOrCreateConversation([userId, targetUserId]);
        if (conversation && conversation.type === 'DIRECT') {


            // Create ONE new SYSTEM message for this unblock event
            const systemMessage = await this._chatRepository.createMessage({
                conversation: { connect: { id: conversation.id } },
                senderId: userId,
                content: 'unblocked',   // Short canonical key — frontend maps to display text
                type: 'SYSTEM',
                status: 'SENT'
            });
            
            // Broadcast to both users
            this._publishToRedis(`chat:${conversation.id}`, {
                type: 'USER_UNBLOCKED',
                data: {
                    conversationId: conversation.id,
                    unblockerId: userId,
                    unblockedId: targetUserId,
                    systemMessage
                }
            }).catch(err => logger.error("Failed to publish USER_UNBLOCKED", err));
        }
    }
    
    async getBlockedUsers(userId: string): Promise<BlockedUser[]> {
        return await this._chatRepository.getBlockedUsers(userId);
    }
    
    async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
        return await this._chatRepository.isUserBlocked(userId, targetUserId);
    }
}
