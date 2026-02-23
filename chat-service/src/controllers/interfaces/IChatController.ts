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
  getSharedMedia(req: Request, res: Response): Promise<void>;

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

  /**
   * Get a single conversation by ID
   */
  getConversationById(req: Request, res: Response): Promise<void>;
  getConversationProfile(req: Request, res: Response): Promise<void>;
  softDeleteConversation(req: Request, res: Response): Promise<void>;
  clearChatHistory(req: Request, res: Response): Promise<void>;

  // --- Message Actions ---
  sendMessage(req: Request, res: Response): Promise<void>;
  editMessage(req: Request, res: Response): Promise<void>;
  deleteMessage(req: Request, res: Response): Promise<void>;
  replyToMessage(req: Request, res: Response): Promise<void>;
  addReaction(req: Request, res: Response): Promise<void>;
  removeReaction(req: Request, res: Response): Promise<void>;
  pinMessage(req: Request, res: Response): Promise<void>;
  unpinMessage(req: Request, res: Response): Promise<void>;
  getPinnedMessages(req: Request, res: Response): Promise<void>;
  forwardMessage(req: Request, res: Response): Promise<void>;

  // --- User Actions ---
  blockUser(req: Request, res: Response): Promise<void>;
  unblockUser(req: Request, res: Response): Promise<void>;
  getBlockedUsers(req: Request, res: Response): Promise<void>;
  getCommonGroups(req: Request, res: Response): Promise<void>;

  // --- Search ---
  searchMessages(req: Request, res: Response): Promise<void>;

  // --- Links ---
  getConversationLinks(req: Request, res: Response): Promise<void>;
}
