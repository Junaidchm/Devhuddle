import { Router } from 'express';
import { ChatController } from '../controllers/impliments/chat.controller';
import { validateDto, validateQuery } from '../middleware/validation.middleware';
import { CreateConversationDto, GetMessagesDto } from '../dtos/chat.dto';

export function createChatRoutes(chatController: ChatController): Router {
  const router = Router();

  // Note: Authentication is handled by API Gateway
  // Gateway forwards req.user after JWT verification
  // So we only need validation here

  /**
   * GET /conversations
   * Get all conversations for the authenticated user
   */
  router.get('/conversations', (req, res) => 
    chatController.getUserConversations(req, res)
  );

  /**
   * GET /conversations/:conversationId/messages
   * Get messages from a specific conversation with pagination
   * Query params validated by GetMessagesDto
   */
  router.get('/conversations/:conversationId/messages',
    validateQuery(GetMessagesDto),  // Validate query params
    (req, res) => chatController.getConversationMessages(req, res)
  );

  /**
   * POST /conversations
   * Create a new conversation
   * Body validated by CreateConversationDto
   */
  router.post('/conversations',
    validateDto(CreateConversationDto),  // Validate request body
    (req, res) => chatController.createConversation(req, res)
  );

  return router;
}
