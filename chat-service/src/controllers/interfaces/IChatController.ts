import { Request, Response } from 'express';

export interface IChatController {
  /**
   * Get all conversations for the authenticated user
   */
  getUserConversations(req: Request, res: Response): Promise<void>;

  /**
   * Get messages from a specific conversation with pagination
   */
  getConversationMessages(req: Request, res: Response): Promise<void>;

  /**
   * Create a new conversation
   */
  createConversation(req: Request, res: Response): Promise<void>;

  /**
   * Check if a conversation exists
   */
  checkConversationExists(req: Request, res: Response): Promise<void>;

  /**
   * Delete a group conversation (owner only)
   */
  deleteGroup(req: Request, res: Response): Promise<void>;
}
