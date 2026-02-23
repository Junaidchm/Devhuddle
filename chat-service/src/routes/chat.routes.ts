import { Router } from 'express';
import { ChatController } from '../controllers/impliments/chat.controller';
import { GroupController } from '../controllers/impliments/group.controller';
import { ReportController } from '../controllers/impliments/report.controller';
import { validateDto, validateQuery } from '../middleware/validation.middleware';
import { CreateConversationDto, GetMessagesDto, CheckConversationDto, CreateGroupDto, GetGroupsDto } from '../dtos/chat.dto';


export function createChatRoutes(
  chatController: ChatController, 
  groupController: GroupController,
  reportController: ReportController
): Router {
  const router = Router();

  // --- Chat Routes ---

  /**
   * GET /conversations?limit=20&offset=0
   * Get all conversations for the authenticated user with metadata
   * Query params: limit (default: 50, max: 100), offset (default: 0)
   */
  router.get('/conversations' , chatController.getUserConversations.bind(chatController));

  /**
   * GET /conversations/:conversationId/messages
   * Get messages from a specific conversation with pagination
   * Query params validated by GetMessagesDto
   */
  router.get('/conversations/:conversationId/messages',
    validateQuery(GetMessagesDto),
    chatController.getConversationMessages.bind(chatController)
  );
  
  router.get('/conversations/:conversationId/media',
    chatController.getSharedMedia.bind(chatController)
  );

  router.get('/conversations/:conversationId/links',
    chatController.getConversationLinks.bind(chatController)
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

  /**
   * GET /conversations/:conversationId
   * Get a single conversation with enriched metadata
   */
  router.get('/conversations/:conversationId',
    chatController.getConversationById.bind(chatController)
  );

  router.get('/conversations/:conversationId/profile',
    chatController.getConversationProfile.bind(chatController)
  );

  router.delete('/conversations/:conversationId',
    chatController.softDeleteConversation.bind(chatController)
  );

  router.post('/conversations/:conversationId/clear',
    chatController.clearChatHistory.bind(chatController)
  );

  /**
   * POST /conversations/check
   * Check if a conversation already exists between users (duplicate prevention)
   * Body validated by CheckConversationDto
   */
  router.post('/conversations/check',
    validateDto(CheckConversationDto),
    chatController.checkConversationExists.bind(chatController)
  );

  // --- Group Routes ---

  // --- Group Routes ---

  router.get('/groups', 
    validateQuery(GetGroupsDto),
    groupController.getAllGroups.bind(groupController)
  );

  router.get('/groups/my-hubs', groupController.getMyGroups.bind(groupController));
  router.get('/groups/discover', groupController.getDiscoverGroups.bind(groupController));
  router.get('/groups/topics', groupController.getGroupTopics.bind(groupController));
  
  router.post('/groups', 
    validateDto(CreateGroupDto),
    groupController.createGroup.bind(groupController)
  );
  router.get('/groups/:id', groupController.getGroupDetails.bind(groupController));
  
  router.post('/groups/:id/participants', groupController.addParticipants.bind(groupController));
  router.delete('/groups/:id/participants/:userId', groupController.removeParticipant.bind(groupController));
  
  router.post('/groups/:id/admins/:userId', groupController.promoteToAdmin.bind(groupController));
  router.delete('/groups/:id/admins/:userId', groupController.demoteToMember.bind(groupController));
  
  router.put('/groups/:id', groupController.updateGroupInfo.bind(groupController));
  router.post('/groups/:id/leave', groupController.leaveGroup.bind(groupController));
  router.post('/groups/:id/join', groupController.joinGroup.bind(groupController)); // Self-join route
  
  // ✅ NEW: Delete Group Route (mapped to chatController as it handles conversation deletion)
  router.delete('/groups/:id', chatController.deleteGroup.bind(chatController));

  // --- Message Actions ---
  router.put('/messages/:messageId', chatController.editMessage.bind(chatController));
  router.delete('/messages/:messageId', chatController.deleteMessage.bind(chatController));
  router.delete('/messages/:messageId/me', chatController.deleteMessage.bind(chatController));
  
  // Standard Send Message
  router.post('/conversations/:conversationId/messages', chatController.sendMessage.bind(chatController));
  
  // Reply Message
  router.post('/conversations/:conversationId/messages/reply', chatController.replyToMessage.bind(chatController));
  
  router.post('/messages/:messageId/reactions', chatController.addReaction.bind(chatController));
  router.delete('/messages/:messageId/reactions', chatController.removeReaction.bind(chatController));
  
  router.post('/messages/:messageId/pin', chatController.pinMessage.bind(chatController));
  router.delete('/messages/:messageId/pin', chatController.unpinMessage.bind(chatController));
  router.get('/conversations/:conversationId/pins', chatController.getPinnedMessages.bind(chatController));
  
  router.post('/messages/forward', chatController.forwardMessage.bind(chatController));
  
  // --- User Blocking ---
  router.post('/users/:userId/block', chatController.blockUser.bind(chatController));
  router.delete('/users/:userId/block', chatController.unblockUser.bind(chatController));
  router.get('/users/blocked', chatController.getBlockedUsers.bind(chatController));
  router.get('/users/:targetUserId/common-groups', chatController.getCommonGroups.bind(chatController));
  
  // --- Search ---
  router.get('/conversations/:conversationId/search', chatController.searchMessages.bind(chatController));

  // --- Reporting ---
  router.post('/reports', reportController.createReport.bind(reportController));
  router.get('/conversations/:conversationId/reports', reportController.getReportsByConversation.bind(reportController));

  return router;
}

