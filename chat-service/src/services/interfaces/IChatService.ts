import { Message, Conversation, Participant } from "@prisma/client";
import { ConversationWithMetadataDto } from "../../dtos/chat-service.dto";
import { MessageResponseDto } from "../../dtos/response/message.dto";

export interface IChatService {
    sendMessage(
        senderId: string, 
        recipientIds: string[], 
        content: string,
        // Media fields
        messageType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER' | 'SYSTEM',
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
    ): Promise<Message>;
    getConversationMessages(conversationId: string, userId: string, limit: number, offset: number, before?: Date): Promise<Message[]>;
    getSharedMedia(
        conversationId: string, 
        userId: string, 
        types: string[], 
        limit: number, 
        offset: number
    ): Promise<Message[]>;
    getUserConversations(userId: string): Promise<Conversation[]>;
    findOrCreateConversation(participantIds: string[]): Promise<ConversationWithMetadataDto>;
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
    
    // Update message delivery status
    updateMessageStatus(
        messageId: string,
        userId: string,
        status: 'DELIVERED' | 'READ'
    ): Promise<Message>;
    
    // Mark all messages up to lastReadMessageId as READ
    markMessagesAsRead(
        conversationId: string,
        userId: string,
        lastReadMessageId: string
    ): Promise<void>;

    // Delete a group conversation (owner only)
    deleteGroup(conversationId: string, userId: string): Promise<void>;

    // Get single conversation with metadata
    getConversationWithMetadata(conversationId: string, userId: string): Promise<ConversationWithMetadataDto | null>;

    // Message Actions
    editMessage(messageId: string, userId: string, newContent: string): Promise<Message>;
    deleteMessage(messageId: string, userId: string): Promise<void>;
    deleteMessageForMe(messageId: string, userId: string): Promise<void>;
    replyToMessage(senderId: string, conversationId: string, content: string, replyToId: string, dedupeId?: string): Promise<Message>;
    addReaction(messageId: string, userId: string, emoji: string): Promise<void>;
    removeReaction(messageId: string, userId: string, emoji: string): Promise<void>;
    pinMessage(messageId: string, userId: string): Promise<void>;
    unpinMessage(messageId: string, userId: string): Promise<void>;
    getPinnedMessages(conversationId: string, userId: string): Promise<Message[]>;
    forwardMessage(messageIds: string[], targetConversationIds: string[], userId: string): Promise<MessageResponseDto[]>;
    
    // Blocking
    blockUser(userId: string, targetUserId: string): Promise<void>;
    unblockUser(userId: string, targetUserId: string): Promise<void>;
    getBlockedUsers(userId: string): Promise<any[]>;
    isUserBlocked(userId: string, targetUserId: string): Promise<boolean>;
    getCommonGroups(userId: string, targetUserId: string): Promise<Conversation[]>;
    
    // Conversation Lifecycle
    softDeleteConversation(conversationId: string, userId: string): Promise<void>;
    clearChatHistory(conversationId: string, userId: string): Promise<void>;
    
    // Search
    searchMessages(conversationId: string, userId: string, query: string): Promise<Message[]>;

    // Links
    getConversationLinks(conversationId: string, userId: string, limit: number, offset: number): Promise<any[]>;
}

