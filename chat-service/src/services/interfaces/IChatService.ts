import { Message, Conversation, Participant } from "@prisma/client";

export interface IChatService {
    sendMessage(senderId: string, recipientIds: string[], content: string): Promise<Message>;
    getConversationMessages(conversationId: string, userId: string, limit: number, offset: number): Promise<Message[]>;
    getUserConversations(userId: string): Promise<Conversation[]>;
    findOrCreateConversation(participantIds: string[]): Promise<Conversation>;
    findConversationById(conversationId: string): Promise<(Conversation & { participants: Participant[] }) | null>;
}
