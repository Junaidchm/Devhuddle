import { IChatService } from "../interfaces/IChatService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Message, Conversation, Prisma, Participant } from "@prisma/client";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis-cache.util";
import {
    SendMessageCommand,
    CreateConversationCommand,
    GetMessagesQuery,
    GetUserConversationsQuery
} from "../../dtos/chat-service.dto";

export class ChatService implements IChatService {

    constructor(private _chatRepository: IChatRepository) {}

    /**
     * Send a message (uses Command pattern with business validation)
     * Invalidates cache after sending
     */
    async sendMessage(senderId: string, recipientIds: string[], content: string): Promise<Message> {
        try {
            // Create and validate command (business rules validated here)
            const command = new SendMessageCommand(senderId, recipientIds, content);

            // Combine sender and recipients to get all participants
            const participantIds = [senderId, ...recipientIds];

            // Find or create conversation
            const conversation = await this._chatRepository.findOrCreateConversation(participantIds);

            // Create message data
            const messageData: Prisma.MessageCreateInput = {
                senderId: command.senderId,
                content: command.content,
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
            for (const participantId of participantIds) {
                await RedisCacheService.invalidateUserConversationsCache(participantId);
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
    async getConversationMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
        try {
            // Create and validate query (business rules validated here)
            const query = new GetMessagesQuery(conversationId, userId, limit, offset);

            // Try to get from cache first
            const cachedMessages = await RedisCacheService.getCachedMessages(
                query.conversationId,
                query.limit,
                query.offset
            );

            if (cachedMessages) {
                logger.info("Retrieved messages from cache", {
                    conversationId: query.conversationId,
                    messageCount: cachedMessages.length
                });
                return cachedMessages;
            }

            // Cache miss - verify user is a participant
            const conversation = await this._chatRepository.findConversationById(query.conversationId);

            if (!conversation) {
                throw new Error("Conversation not found");
            }

            // Check if user is a participant
            const isParticipant = conversation.participants.some(
                (p: Participant) => p.userId === query.userId
            );

            if (!isParticipant) {
                throw new Error("Unauthorized: User is not a participant in this conversation");
            }

            // Get messages from database
            const messages = await this._chatRepository.getMessagesByConversationId(
                query.conversationId,
                query.limit,
                query.offset
            );

            // Cache the results
            await RedisCacheService.cacheMessages(
                query.conversationId,
                query.limit,
                query.offset,
                messages
            );

            logger.info("Retrieved conversation messages from DB", {
                conversationId: query.conversationId,
                userId: query.userId,
                messageCount: messages.length
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
     * Find or create conversation (uses Command pattern with business validation)
     * Invalidates cache if conversation is created
     */
    async findOrCreateConversation(participantIds: string[]): Promise<Conversation> {
        try {
            // We need to extract initiator - assume first participant is initiator
            // In real scenario, this would come from the request
            const [initiatorId, ...otherParticipants] = participantIds;

            // Create and validate command (business rules validated here)
            const command = new CreateConversationCommand(initiatorId, otherParticipants);

            // Get all unique participants
            const allParticipants = command.getAllParticipants();

            const conversation = await this._chatRepository.findOrCreateConversation(allParticipants);

            // Invalidate user conversations cache for all participants
            for (const participantId of allParticipants) {
                await RedisCacheService.invalidateUserConversationsCache(participantId);
            }

            logger.info("Found or created conversation", {
                conversationId: conversation.id,
                participantCount: allParticipants.length
            });

            return conversation;
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
}
