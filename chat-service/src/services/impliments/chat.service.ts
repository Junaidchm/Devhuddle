import { IChatService } from "../interfaces/IChatService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Message, Conversation, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class ChatService implements IChatService {
    private chatRepository: IChatRepository;

    constructor(chatRepository: IChatRepository) {
        this.chatRepository = chatRepository;
    }

    async sendMessage(senderId: string, recipientIds: string[], content: string): Promise<Message> {
        try {
            // Combine sender and recipients to get all participants
            const participantIds = [senderId, ...recipientIds];

            // Find or create conversation
            const conversation = await this.chatRepository.findOrCreateConversation(participantIds);

            // Create message data
            const messageData: Prisma.MessageCreateInput = {
                senderId,
                content,
                conversation: {
                    connect: {
                        id: conversation.id
                    }
                }
            };

            // Create the message
            const message = await this.chatRepository.createMessage(messageData);

            // Update conversation's last message timestamp
            await this.chatRepository.updateLastMessageAt(conversation.id, new Date());

            logger.info("Message sent successfully", {
                messageId: message.id,
                conversationId: conversation.id,
                senderId
            });

            return message;
        } catch (error) {
            logger.error("Error in sendMessage service", { error: (error as Error).message });
            throw new Error("Failed to send message");
        }
    }

    async getConversationMessages(conversationId: string, userId: string, limit: number = 50, offset: number = 0): Promise<Message[]> {
        try {
            // Verify user is a participant in this conversation
            const conversation = await this.chatRepository.findConversationById(conversationId);

            if (!conversation) {
                throw new Error("Conversation not found");
            }

            // Check if user is a participant (conversation must include participants)
            const conversationWithParticipants = await this.chatRepository.findConversationById(conversationId);
            
            if (!conversationWithParticipants) {
                throw new Error("Unauthorized: User is not a participant in this conversation");
            }

            // Get messages
            const messages = await this.chatRepository.getMessagesByConversationId(conversationId, limit, offset);

            logger.info("Retrieved conversation messages", {
                conversationId,
                userId,
                messageCount: messages.length
            });

            return messages;
        } catch (error) {
            logger.error("Error in getConversationMessages service", { error: (error as Error).message });
            throw new Error("Failed to retrieve conversation messages");
        }
    }

    async getUserConversations(userId: string): Promise<Conversation[]> {
        try {
            const conversations = await this.chatRepository.getUserConversations(userId);

            logger.info("Retrieved user conversations", {
                userId,
                conversationCount: conversations.length
            });

            return conversations;
        } catch (error) {
            logger.error("Error in getUserConversations service", { error: (error as Error).message });
            throw new Error("Failed to retrieve user conversations");
        }
    }

    async findOrCreateConversation(participantIds: string[]): Promise<Conversation> {
        try {
            if (!participantIds || participantIds.length < 2) {
                throw new Error("At least 2 participants are required to create a conversation");
            }

            const conversation = await this.chatRepository.findOrCreateConversation(participantIds);

            logger.info("Found or created conversation", {
                conversationId: conversation.id,
                participantCount: participantIds.length
            });

            return conversation;
        } catch (error) {
            logger.error("Error in findOrCreateConversation service", { error: (error as Error).message });
            throw new Error("Failed to find or create conversation");
        }
    }
}
