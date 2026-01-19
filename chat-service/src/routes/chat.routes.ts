import { Router } from 'express';
import { ChatController } from '../controllers/impliments/chat.controller';
import { validateDto, validateQuery } from '../middleware/validation.middleware';
import { CreateConversationDto, GetMessagesDto } from '../dtos/chat.dto';

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  /**
   * GET /conversations
   * Get all conversations for the authenticated user
   */
  router.get('/conversations', chatController.getUserConversations.bind(chatController));

  /**
   * GET /conversations/:conversationId/messages
   * Get messages from a specific conversation with pagination
   * Query params validated by GetMessagesDto
   */
  router.get('/conversations/:conversationId/messages',
    validateQuery(GetMessagesDto),
    chatController.getConversationMessages.bind(chatController)
  );

  /**
   * POST /conversations
   * Create a new conversation
   * Body validated by CreateConversationDto
   */
  router.post('/conversations',
    validateDto(CreateConversationDto),
    chatController.createConversation.bind(chatController)
  );

  return router;
}
