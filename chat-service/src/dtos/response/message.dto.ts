/**
 * Response DTO for a message
 * Pure interface without validation decorators
 */
export interface MessageResponseDto {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  
  // Added fields
  status: 'SENT' | 'DELIVERED' | 'READ';
  deliveredAt?: Date | null;
  readAt?: Date | null;
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    senderName?: string; // Optional, might need enrichment
  } | null;
  dedupeId?: string;
  reactions?: {
    id: string;
    emoji: string;
    userId: string;
  }[];
  
  // Media fields (optional but good to have in DTO)
  type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | 'STICKER';
  mediaUrl?: string | null;
  mediaId?: string | null;
  mediaMimeType?: string | null;
  mediaSize?: number | null;
  mediaName?: string | null;
  mediaDuration?: number | null;
  
  // Forwarding lineage
  isForwarded?: boolean;
  forwardedFrom?: string;
  originalMessageId?: string;
}
