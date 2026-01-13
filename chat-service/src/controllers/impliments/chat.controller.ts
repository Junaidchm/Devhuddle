import { Request, Response } from 'express';
import { IChatController } from '../interfaces/IChatController';
import { ChatService } from '../../services/impliments/chat.service';
import logger from '../../utils/logger.util';

export class ChatController implements IChatController {
  constructor(private _chatService: ChatService) {}

  /**
   * GET /conversations
   * Get all conversations for authenticated user
   */
  async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      const conversations = await this._chatService.getUserConversations(userId);

      res.status(200).json({
        success: true,
        data: conversations
      });
    } catch (error) {
      logger.error('Error getting user conversations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations'
      });
    }
  }

  /**
   * GET /conversations/:conversationId/messages
   * Get messages from a conversation with pagination
   * Query params already validated by GetMessagesDto middleware
   */
  async getConversationMessages(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const conversationId = req.params.conversationId as string;
      
      // Query params already validated AND transformed to numbers by middleware
      const { limit = 50, offset = 0 } = req.query as { limit?: number; offset?: number };

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // No need to validate conversationId, limit, offset - middleware did it
      const messages = await this._chatService.getConversationMessages(
        conversationId,
        userId,
        limit,
        offset
      );

      res.status(200).json({
        success: true,
        data: messages,
        pagination: {
          limit,
          offset,
          count: messages.length
        }
      });
    } catch (error) {
      logger.error('Error getting conversation messages', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        conversationId: req.params.conversationId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages'
      });
    }
  }

  /**
   * POST /conversations
   * Create a new conversation
   * Body already validated by CreateConversationDto middleware
   */
  async createConversation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      // DTO middleware already validated this is a non-empty array of strings
      const { participantIds } = req.body as { participantIds: string[] };

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // No need to validate participantIds - middleware did it
      // Add current user to participants if not already included
      const allParticipants = [userId, ...participantIds.filter(id => id !== userId)];

      const conversation = await this._chatService.findOrCreateConversation(allParticipants);

      res.status(201).json({
        success: true,
        data: conversation
      });
    } catch (error) {
      logger.error('Error creating conversation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to create conversation'
      });
    }
  }
}
