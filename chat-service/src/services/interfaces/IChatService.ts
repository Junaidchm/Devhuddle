import { Message, Conversation, Participant } from "@prisma/client";
import { ConversationWithMetadataDto } from "../../dtos/chat-service.dto";

export interface IChatService {
    sendMessage(senderId: string, recipientIds: string[], content: string): Promise<Message>;
    getConversationMessages(conversationId: string, userId: string, limit: number, offset: number): Promise<Message[]>;
    getUserConversations(userId: string): Promise<Conversation[]>;
    findOrCreateConversation(participantIds: string[]): Promise<Conversation>;
    findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null>;
    
    // Get conversations with enriched metadata (includes user profiles)
    getUserConversationsWithMetadata(
        userId: string,
        limit: number,
        offset: number
    ): Promise<ConversationWithMetadataDto[]>;
    
    // Check if conversation exists between users
    checkConversationExists(
        currentUserId: string,
        participantIds: string[]
    ): Promise<{ exists: boolean; conversationId?: string }>;
}

