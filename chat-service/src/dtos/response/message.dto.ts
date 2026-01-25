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
}
