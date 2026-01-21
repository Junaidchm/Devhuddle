import { Request, Response } from 'express';
import { IChatController } from '../interfaces/IChatController';
import logger from '../../utils/logger.util';
import { IChatService } from '../../services/interfaces/IChatService';

export class ChatController implements IChatController {
  constructor(private _chatService: IChatService) {}

  /**
   * GET /conversations?limit=20&offset=0
   * Get all conversations for authenticated user with metadata
   * Includes last message, unread count, and enriched participant data
   */
  async getUserConversations(req: Request, res: Response): Promise<void> {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Get pagination params from query (with defaults)
      const limit = Math.min(Number(req.query.limit) || 50, 100); // Max 100
      const offset = Math.max(Number(req.query.offset) || 0, 0); // Min 0

      // Use the new metadata service for enriched conversations
      const conversations = await this._chatService.getUserConversationsWithMetadata(
        userId,
        limit,
        offset
      );

      logger.info('User conversations fetched successfully', {
        userId,
        limit,
        offset,
        count: conversations.length
      });

      res.status(200).json({
        success: true,
        data: conversations,
        pagination: {
          limit,
          offset,
          count: conversations.length
        }
      });
    } catch (error) {
      logger.error('Error getting user conversations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined
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
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
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
        userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined,
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
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
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
        userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined
      });

      res.status(500).json({
        success: false,
        message: 'Failed to create conversation'
      });
    }
  }

  /**
   * POST /conversations/check
   * Check if conversation exists between users (duplicate prevention)
   * Body already validated by CheckConversationDto middleware
   */
  async checkConversationExists(req: Request, res: Response): Promise<void> {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const { participantIds } = req.body as { participantIds: string[] };

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // Check if conversation exists (doesn't create one)
      const result = await this._chatService.checkConversationExists(userId, participantIds);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error checking conversation existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined,
        participantIds: req.body?.participantIds
      });

      // Business validation errors should be sent to client
      if (error instanceof Error && error.message.includes('Cannot include yourself')) {
        res.status(400).json({
          success: false,
          message: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Failed to check conversation'
      });
    }
  }
}

