// Re-export all request DTOs
export { CreateConversationDto } from './request/create-conversation.dto';
export { GetMessagesDto } from './request/get-messages.dto';
export { CheckConversationDto } from './request/check-conversation.dto';
export { GetChatStatsDto, GetRecentChatPartnersDto } from './request/chat-stats.dto';

// Re-export all response DTOs
export { MessageResponseDto } from './response/message.dto';
export { 
  ConversationResponseDto, 
  ConversationWithMetadataDto,
  ParticipantDto,
  ConversationExistsResponseDto
} from './response/conversation.dto';
export {
  ChatInteractionStatsDto,
  GetChatStatsResponseDto,
  GetRecentChatPartnersResponseDto
} from './response/chat-stats.dto';

// Re-export internal command/query classes
export {
  SendMessageCommand,
  CreateConversationCommand,
  GetMessagesQuery,
  GetUserConversationsQuery,
  GetUserConversationsWithMetadataQuery,
  CheckConversationExistsQuery
} from './internal/commands-queries';
