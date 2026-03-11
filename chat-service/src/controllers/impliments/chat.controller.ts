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

      // Get pagination params from validated query (or raw query with defaults)
      const queryParams = (req as any).validatedQuery || req.query;
      const limit = Math.min(Number(queryParams.limit) || 50, 100); // Max 100
      const offset = Math.max(Number(queryParams.offset) || 0, 0); // Min 0

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
      
      // Query params validated by middleware
      // Use validatedQuery if attached by middleware, otherwise fallback to req.query
      const queryParams = (req as any).validatedQuery || req.query;
      // Extract limit, offset AND before (for cursor pagination)
      const { limit = 50, offset = 0 } = queryParams as { limit?: number; offset?: number };
      const beforeQuery = queryParams.before as string;
      const before = beforeQuery ? new Date(beforeQuery) : undefined;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      // No need to validate conversationId, limit, offset - middleware did it (mostly)
      const messages = await this._chatService.getConversationMessages(
        conversationId,
        userId,
        limit,
        offset,
        before
      );

      // ✅ FIX: Return structure that matches frontend expectations
      // Frontend expects: { messages: Message[], hasMore: boolean, pagination?: {} }
      res.status(200).json({
        success: true,
        messages: messages,  // Changed from 'data' to 'messages'
        hasMore: messages.length === limit,  // Added hasMore flag
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

  /**
   * GET /conversations/:conversationId
   * Get a single conversation with enriched metadata
   */
  async getConversationById(req: Request, res: Response): Promise<void> {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const conversationId = req.params.conversationId as string;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          message: 'Conversation ID is required'
        });
        return;
      }

      const conversation = await this._chatService.getConversationWithMetadata(conversationId, userId);

      if (!conversation) {
        res.status(404).json({
          success: false,
          message: 'Conversation not found or you are not a participant'
        });
        return;
      }

      res.status(200).json(conversation);
    } catch (error) {
      logger.error('Error getting conversation by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined,
        conversationId: req.params.conversationId
      });

      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversation'
      });
    }
  }

  /**
   * DELETE /group/:conversationId
   * Delete a group conversation (owner only)
   */
    async deleteGroup(req: Request, res: Response): Promise<void> {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const conversationId = req.params.id as string; // ✅ Fixed: match route param name ':id' from chat.routes.ts

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
        return;
      }

      if (!conversationId) {
        res.status(400).json({
          success: false,
          message: 'Group ID is required'
        });
        return;
      }

      await this._chatService.deleteGroup(conversationId, userId);

      res.status(200).json({
        success: true,
        message: 'Group deleted successfully'
      });
    } catch (error) {
        logger.error('Error deleting group', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId: req.headers["x-user-data"] ? JSON.parse(req.headers["x-user-data"] as string).id : undefined,
            conversationId: req.params.conversationId
        });

        if (error instanceof Error) {
            if (error.message === 'Conversation not found') {
                res.status(404).json({ success: false, message: error.message });
                return;
            }
            if (error.message.includes('Only group conversations')) {
                res.status(400).json({ success: false, message: error.message });
                return;
            }
             if (error.message.includes('Only the group owner')) {
                res.status(403).json({ success: false, message: error.message });
                return;
            }
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete group'
        });
    }
  }

  // --- Message Actions Implementation ---

  async sendMessage(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const { content, type, mediaUrl, mediaId, mediaMimeType, mediaSize, mediaName, mediaDuration, dedupeId } = req.body;

          if (!content && !mediaUrl) {
              res.status(400).json({ success: false, message: "Content or media is required" });
              return;
          }

          const message = await this._chatService.sendMessage(
              userId,
              [], // Recipient IDs are resolved by service/conversationId
              content,
              type || 'TEXT',
              mediaUrl,
              mediaId,
              mediaMimeType,
              mediaSize,
              mediaName,
              mediaDuration,
              conversationId,
              dedupeId
          );

          res.status(201).json({ success: true, data: message });
      } catch (error) {
          this.handleError(res, error, "Error sending message");
      }
  }

    async editMessage(req: Request, res: Response): Promise<void> {
    try {
        const userId = JSON.parse(req.headers["x-user-data"] as string).id;
        const { messageId } = req.params as { messageId: string };
        const { content } = req.body;

        if (!content) {
            res.status(400).json({ success: false, message: "Content is required" });
            return;
        }

        const updatedMessage = await this._chatService.editMessage(messageId, userId, content);
        res.status(200).json({ success: true, data: updatedMessage });
    } catch (error) {
        this.handleError(res, error, "Error editing message");
    }
  }

  async deleteMessage(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { messageId } = req.params as { messageId: string };
          
          // Check if it's a "Delete for me" request based on path or body
          const isDeleteForMe = req.path.endsWith('/me') || req.body?.deleteForEveryone === false;

          if (isDeleteForMe) {
              await this._chatService.deleteMessageForMe(messageId, userId);
          } else {
              await this._chatService.deleteMessage(messageId, userId);
          }
          
          res.status(200).json({ success: true, message: "Message deleted" });
      } catch (error) {
          this.handleError(res, error, "Error deleting message");
      }
  }

  async replyToMessage(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const { content, replyToId, dedupeId } = req.body;

          if (!content || !replyToId) {
             res.status(400).json({ success: false, message: "Content and replyToId are required" });
             return;
          }

          const message = await this._chatService.replyToMessage(userId, conversationId, content, replyToId, dedupeId);
          res.status(201).json({ success: true, data: message });
      } catch (error) {
          this.handleError(res, error, "Error replying to message");
      }
  }

  async addReaction(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { messageId } = req.params as { messageId: string };
          const { emoji } = req.body;

          if (!emoji) {
              res.status(400).json({ success: false, message: "Emoji is required" });
              return;
          }

          await this._chatService.addReaction(messageId, userId, emoji);
          res.status(200).json({ success: true, message: "Reaction added" });
      } catch (error) {
          this.handleError(res, error, "Error adding reaction");
      }
  }

  async removeReaction(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { messageId } = req.params as { messageId: string };
          const { emoji } = req.body;

           if (!emoji) {
              res.status(400).json({ success: false, message: "Emoji is required" });
              return;
          }

          await this._chatService.removeReaction(messageId, userId, emoji);
          res.status(200).json({ success: true, message: "Reaction removed" });
      } catch (error) {
          this.handleError(res, error, "Error removing reaction");
      }
  }

  async pinMessage(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { messageId } = req.params as { messageId: string };
          await this._chatService.pinMessage(messageId, userId);
           res.status(200).json({ success: true, message: "Message pinned" });
      } catch (error) {
          this.handleError(res, error, "Error pinning message");
      }
  }

  async unpinMessage(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { messageId } = req.params as { messageId: string };
          await this._chatService.unpinMessage(messageId, userId);
          res.status(200).json({ success: true, message: "Message unpinned" });
      } catch (error) {
          this.handleError(res, error, "Error unpinning message");
      }
  }

  async getPinnedMessages(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const messages = await this._chatService.getPinnedMessages(conversationId, userId);
          res.status(200).json({ success: true, data: messages });
      } catch (error) {
          this.handleError(res, error, "Error fetching pinned messages");
      }
  }

  async forwardMessage(req: Request, res: Response): Promise<void> {
      try {
           const userId = JSON.parse(req.headers["x-user-data"] as string).id;
           const { messageIds, targetConversationIds } = req.body; // arrays of strings

           if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
               res.status(400).json({ success: false, message: "Message IDs required for forwarding" });
               return;
           }

           if (!targetConversationIds || !Array.isArray(targetConversationIds) || targetConversationIds.length === 0) {
               res.status(400).json({ success: false, message: "Target conversation IDs required" });
               return;
           }

           const results = await this._chatService.forwardMessage(messageIds, targetConversationIds, userId);
           res.status(200).json({ success: true, message: "Messages forwarded", data: results });
      } catch (error) {
          this.handleError(res, error, "Error forwarding message");
      }
  }


  async blockUser(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { userId: targetUserId } = req.params as { userId: string }; // /users/:userId/block

          await this._chatService.blockUser(userId, targetUserId);
          res.status(200).json({ success: true, message: "User blocked" });
      } catch (error) {
          this.handleError(res, error, "Error blocking user");
      }
  }

  async unblockUser(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { userId: targetUserId } = req.params as { userId: string };

          await this._chatService.unblockUser(userId, targetUserId);
          res.status(200).json({ success: true, message: "User unblocked" });
      } catch (error) {
          this.handleError(res, error, "Error unblocking user");
      }
  }

  async getBlockedUsers(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const users = await this._chatService.getBlockedUsers(userId);
          res.status(200).json({ success: true, data: users });
      } catch (error) {
          this.handleError(res, error, "Error fetching blocked users");
      }
  }

  async getSharedMedia(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const types = (req.query.types as string || '').split(',').filter(Boolean);
          const limit = parseInt(req.query.limit as string) || 20;
          const offset = parseInt(req.query.offset as string) || 0;

          if (types.length === 0) {
              res.status(400).json({ success: false, message: "Media types are required" });
              return;
          }

          const media = await this._chatService.getSharedMedia(conversationId, userId, types, limit, offset);
          res.status(200).json({ success: true, data: media });
      } catch (error) {
          this.handleError(res, error, "Error getting shared media");
      }
  }

  async getConversationProfile(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };

          const conversation = await this._chatService.getConversationWithMetadata(conversationId, userId);
          if (!conversation) {
              res.status(404).json({ success: false, message: "Conversation not found" });
              return;
          }

          // If it's a DIRECT chat, find the other participant to fetch common groups
          let commonGroups: any[] = [];
          if (conversation.type === 'DIRECT') {
              const targetParticipant = conversation.participants.find(p => p.userId !== userId);
              if (targetParticipant) {
                  commonGroups = await this._chatService.getCommonGroups(userId, targetParticipant.userId);
              }
          }

          res.status(200).json({
              success: true,
              data: {
                  conversation,
                  commonGroups
              }
          });
      } catch (error) {
          this.handleError(res, error, "Error getting conversation profile");
      }
  }

  async softDeleteConversation(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };

          await this._chatService.softDeleteConversation(conversationId, userId);
          res.status(200).json({ success: true, message: "Conversation deleted for user" });
      } catch (error) {
          this.handleError(res, error, "Error deleting conversation");
      }
  }

  async clearChatHistory(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };

          await this._chatService.clearChatHistory(conversationId, userId);
          res.status(200).json({ success: true, message: "Chat history cleared" });
      } catch (error) {
          this.handleError(res, error, "Error clearing chat history");
      }
  }

  async getCommonGroups(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { targetUserId } = req.params as { targetUserId: string };

          const groups = await this._chatService.getCommonGroups(userId, targetUserId);
          res.status(200).json({ success: true, data: groups });
      } catch (error) {
          this.handleError(res, error, "Error getting common groups");
      }
  }

  async searchMessages(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const { q } = req.query;

          if (!q) {
               res.status(400).json({ success: false, message: "Search query required" });
               return;
          }

          const query = String(q);
          const messages = await this._chatService.searchMessages(conversationId, userId, query);
          res.status(200).json({ success: true, data: messages });
      } catch (error) {
          this.handleError(res, error, "Error searching messages");
      }
  }

  async getConversationLinks(req: Request, res: Response): Promise<void> {
      try {
          const userId = JSON.parse(req.headers["x-user-data"] as string).id;
          const { conversationId } = req.params as { conversationId: string };
          const limit = parseInt(req.query.limit as string) || 20;
          const offset = parseInt(req.query.offset as string) || 0;

          const links = await this._chatService.getConversationLinks(conversationId, userId, limit, offset);
          res.status(200).json({ success: true, data: links });
      } catch (error) {
          this.handleError(res, error, "Error getting conversation links");
      }
  }

  private handleError(res: Response, error: any, context: string) {
      logger.error(context, { error: error instanceof Error ? error.message : "Unknown error" });
      
      const statusCode = error.statusCode || error.status || 500;
      
      if (statusCode !== 500) {
          res.status(statusCode).json({ success: false, message: error.message });
          return;
      }
      
      if (error instanceof Error) {
          // Fallback string matching for untyped errors
          if (error.message.includes("not found")) {
              res.status(404).json({ success: false, message: error.message });
          } else if (error.message.includes("Unauthorized") || error.message.includes("can only") || error.message.includes("Not a participant")) {
              res.status(403).json({ success: false, message: error.message });
          } else {
              res.status(500).json({ success: false, message: error.message || context });
          }
      } else {
          res.status(500).json({ success: false, message: context });
      }
  }
}


