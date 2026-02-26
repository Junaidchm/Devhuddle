import { Conversation, GroupRole, Participant } from "@prisma/client";
import { IGroupService } from "../interfaces/IGroupService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { AppError } from "../../utils/AppError";
import { authServiceClient } from "../../clients/auth-service.client";
import { ConversationWithMetadataDto, GroupListDto } from "../../dtos/chat-service.dto";

import { redisPublisher } from "../../config/redis.config";
import logger from "../../utils/logger.util";

import { MessageSagaService } from "./message.service";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { IHubJoinRequestRepository } from "../../repositories/interfaces/IHubJoinRequestRepository";
import { publishChatEvent } from "../../utils/kafka.util";

export class GroupService implements IGroupService {
  constructor(
    private _chatRepository: IChatRepository,
    private _messageSagaService: MessageSagaService,
    private _hubJoinRequestRepository: IHubJoinRequestRepository
  ) {
    // 🔥 Trigger initialization of member counts for existing groups
    this._chatRepository.syncAllMemberCounts().catch(err => {
        logger.error("Failed to sync member counts on startup", { error: err.message });
    });
  }

  async createGroup(
    creatorId: string, 
    name: string, 
    participantIds: string[], 
    icon?: string,
    onlyAdminsCanPost: boolean = false,
    onlyAdminsCanEditInfo: boolean = false,
    topics: string[] = []
  ): Promise<ConversationWithMetadataDto> {
    if (!name || name.trim().length === 0) {
        throw new AppError("Group name is required", 400);
    }
    if (participantIds.length === 0) {
        throw new AppError("At least one participant is required", 400);
    }
    
    try {
      // Ensure creator is in participant list if not already
      const uniqueParticipants = Array.from(new Set([...participantIds, creatorId]));

      const conversation = await this._chatRepository.createGroupConversation(
        creatorId, 
        name, 
        uniqueParticipants, 
        icon,
        onlyAdminsCanPost,
        onlyAdminsCanEditInfo,
        topics
      );

      // ✅ Auto-assign creator as ADMIN to prevent owner/admin role confusion
      await this._chatRepository.updateParticipantRole(conversation.id, creatorId, GroupRole.ADMIN);

      // Enrich with user profiles
      const userProfilesMap = await authServiceClient.getUserProfiles(uniqueParticipants);

      const enrichedConversation: ConversationWithMetadataDto = {
          conversationId: conversation.id,
          type: conversation.type as 'GROUP', 
          name: conversation.name,
          icon: conversation.icon,
          description: conversation.description,
          ownerId: conversation.ownerId,
          onlyAdminsCanPost: conversation.onlyAdminsCanPost,
          onlyAdminsCanEditInfo: conversation.onlyAdminsCanEditInfo,
          memberCount: conversation.memberCount,
          participantIds: uniqueParticipants,
          participants: conversation.participants.map(p => {
               const profile = userProfilesMap.get(p.userId);
               return {
                   userId: p.userId,
                   username: profile?.username || 'unknown',
                   name: profile?.name || 'Unknown User',
                   profilePhoto: profile?.profilePhoto || null,
                   role: p.role as 'ADMIN' | 'MEMBER'
               };
          }),
          lastMessage: null,
          lastMessageAt: conversation.createdAt,
          unreadCount: 0,
          createdAt: conversation.createdAt
      };

      // ✅ Inject SYSTEM message for group creation via Saga (non-blocking - return HTTP response fast)
      this._messageSagaService.sendSystemMessage(
          conversation.id,
          "group_created",
          creatorId
      ).catch(err => {
          logger.error("Failed to send group_created system message", { error: err.message, conversationId: conversation.id });
      });

      // Emit real-time event to all participants' sockets
      this.publishEvent(conversation.id, 'group_created', enrichedConversation);

      // ✅ Publish GroupCreated Kafka event so notification-service can notify members
      const nonCreatorIds = uniqueParticipants.filter(id => id !== creatorId);
      if (nonCreatorIds.length > 0) {
          publishChatEvent({
              eventType: 'GroupCreated',
              conversationId: conversation.id,
              creatorId,
              groupName: name,
              participantIds: nonCreatorIds
          }).catch(err => {
              logger.error("Failed to publish GroupCreated Kafka event", { error: err.message, conversationId: conversation.id });
          });
      }

      return enrichedConversation;
    } catch (error) {
      logger.error("Failed to create group", { 
        error: (error as Error).message,
        stack: (error as Error).stack,
        creatorId,
        name
      });
      throw error;
    }
  }

  async getAllGroups(
    query?: string,
    topics?: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<ConversationWithMetadataDto[]> {
    const groups = await this._chatRepository.findAllGroups(query, topics, limit, offset);

    // Collect all unique user IDs to fetch profiles
    const allUserIds = new Set<string>();
    groups.forEach(g => g.participants.forEach(p => allUserIds.add(p.userId)));

    const userProfilesMap = await authServiceClient.getUserProfiles(Array.from(allUserIds));

    return groups.map(group => ({
        conversationId: group.id,
        type: group.type as 'GROUP',
        name: group.name,
        icon: group.icon,
        description: group.description,
        ownerId: group.ownerId,
        onlyAdminsCanPost: group.onlyAdminsCanPost,
        onlyAdminsCanEditInfo: group.onlyAdminsCanEditInfo,
        participantIds: group.participants.map(p => p.userId),
        participants: group.participants.map(p => {
            const profile = userProfilesMap.get(p.userId);
            return {
                userId: p.userId,
                username: profile?.username || 'unknown',
                name: profile?.name || 'Unknown User',
                profilePhoto: profile?.profilePhoto || null,
                role: p.role as 'ADMIN' | 'MEMBER'
            };
        }),
        lastMessage: null, // Could fetch if needed, but not critical for list
        lastMessageAt: group.lastMessageAt,
        unreadCount: 0,
        createdAt: group.createdAt
    }));
  }

  async getMyGroups(
    userId: string,
    query?: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<GroupListDto[]> {
    const groups = await this._chatRepository.findMyGroups(userId, query, limit, offset);
    return groups.map(group => ({
      conversationId: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
      memberCount: (group as any).memberCount || group.participants.length,
      topics: group.topics,
      isMember: true, // Always true for my groups
      isRequestPending: false, // User is already a member
      createdAt: group.createdAt
    }));
  }

  async getDiscoverGroups(
    userId: string,
    query?: string,
    topics?: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<GroupListDto[]> {
    const groups = await this._chatRepository.findDiscoverGroups(userId, query, topics, limit, offset);
    
    // Efficiently batch check for pending requests
    const groupIds = groups.map(g => g.id);
    const pendingRequests = await this._hubJoinRequestRepository.findPendingRequestsByUser(userId, groupIds);
    const pendingHubIds = new Set(pendingRequests.map(r => r.hubId));

    return groups.map(group => ({
      conversationId: group.id,
      name: group.name,
      description: group.description,
      icon: group.icon,
      memberCount: (group as any).memberCount || group.participants.length,
      topics: group.topics,
      isMember: false, // Always false for discover groups
      isRequestPending: pendingHubIds.has(group.id),
      createdAt: group.createdAt
    }));
  }

  async getGroupTopics(limit: number = 10): Promise<{ topic: string; count: number }[]> {
    return await this._chatRepository.getPopularTopics(limit);
  }

  async getGroupDetails(groupId: string): Promise<Conversation & { participants: Participant[] }> {
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (!conversation) throw new AppError("Group not found", 404);
    if (conversation.type !== "GROUP") throw new AppError("Not a group conversation", 400);
    return conversation as Conversation & { participants: Participant[] };
  }

  private async verifyAdmin(userId: string, groupId: string): Promise<{ isAdmin: boolean; isOwner: boolean }> {
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (!conversation) throw new AppError("Group not found", 404);

    const participant = conversation.participants.find(p => p.userId === userId);
    
    const isAdmin = participant?.role === GroupRole.ADMIN;
    const isOwner = conversation.ownerId === userId;

    return { isAdmin, isOwner };
  }

  async addParticipants(groupId: string, adminId: string, userIds: string[]): Promise<void> {
    const { isAdmin, isOwner } = await this.verifyAdmin(adminId, groupId);
    if (!isAdmin && !isOwner) {
        throw new AppError("Only admins can add participants", 403);
    }
    
    const addedUserIds: string[] = [];
    for (const userId of userIds) {
        const existing = await this._chatRepository.findParticipantInConversation(userId, groupId);
        if (!existing) {
             await this._chatRepository.addParticipantToGroup(groupId, userId);
             addedUserIds.push(userId);
        }
    }

    if (addedUserIds.length > 0) {
        // Enriched profiles for the new participants to send to clients
        const userProfilesMap = await authServiceClient.getUserProfiles(addedUserIds);
        const addedParticipants = addedUserIds.map(id => ({
            userId: id,
            username: userProfilesMap.get(id)?.username || 'unknown',
            name: userProfilesMap.get(id)?.name || 'Unknown User',
            profilePhoto: userProfilesMap.get(id)?.profilePhoto || null,
            role: 'MEMBER'
        }));

        const snapshottedAdded = addedParticipants.map(ap => ({ id: ap.userId, name: ap.name }));

        // ✅ Inject SYSTEM message for added participants via Saga (Blocking)
        await this._messageSagaService.sendSystemMessage(
            groupId,
            `added_participant:${JSON.stringify(snapshottedAdded)}`,
            adminId
        );

        // Update member count atomically
        const newMemberCount = await this._chatRepository.updateMemberCount(groupId, addedUserIds.length);

        this.publishEvent(groupId, 'participants_added', {
            conversationId: groupId,
            addedBy: adminId,
            participants: addedParticipants,
            memberCount: newMemberCount
        });
    }
  }

  async removeParticipant(groupId: string, adminId: string, targetUserId: string): Promise<void> {
    const { isOwner, isAdmin } = await this.verifyAdmin(adminId, groupId);
    
    if (!isAdmin && !isOwner) {
        throw new AppError("Only admins can remove participants", 403);
    }

    const conversation = await this._chatRepository.findConversationById(groupId);
    if (!conversation) throw new Error("Group not found");

    const targetParticipant = conversation.participants.find(p => p.userId === targetUserId);
    if (!targetParticipant) throw new Error("User is not a participant");

    // Hierarchy check: Admin cannot remove Owner or another Admin
    if (!isOwner && (targetUserId === conversation.ownerId || targetParticipant.role === GroupRole.ADMIN)) {
        throw new AppError("Admins cannot remove other admins or the owner", 403);
    }

    const targetProfile = await authServiceClient.getUserProfiles([targetUserId]);
    const snapshotName = targetProfile.get(targetUserId)?.name || targetProfile.get(targetUserId)?.username || targetUserId;

    await this._chatRepository.removeParticipantFromGroup(groupId, targetUserId);
    
    // ✅ Invalidate caches
    await RedisCacheService.invalidateConversationCache(groupId);
    await RedisCacheService.invalidateUserConversationsMetadataCache(targetUserId);

    // ✅ Inject SYSTEM message via Saga (Blocking)
    await this._messageSagaService.sendSystemMessage(
        groupId,
        `removed_participant:${JSON.stringify({ id: targetUserId, name: snapshotName })}`,
        adminId
    );

    // Update member count atomically
    const newMemberCount = await this._chatRepository.updateMemberCount(groupId, -1);

    this.publishEvent(groupId, 'participant_removed', {
      conversationId: groupId,
      removedUserId: targetUserId,
      removedBy: adminId,
      memberCount: newMemberCount
    });
  }

  async promoteToAdmin(groupId: string, adminId: string, targetUserId: string): Promise<void> {
    const isSelfPromotion = adminId === targetUserId;
    
    // Verify adminId has permission (Owner or Admin)
    const { isOwner, isAdmin } = await this.verifyAdmin(adminId, groupId);
    
    if (!isAdmin && !isOwner) {
        // Allow promotion if group has no admins at all (Edge case)
        const participants = await this._chatRepository.findConversationById(groupId);
        const hasAdmins = participants?.participants.some(p => p.role === GroupRole.ADMIN);
        if (hasAdmins && !isOwner && !isAdmin) {
            throw new AppError("Only admins can promote others", 403);
        }
    }

    // Capture snapshot of target name for system message before role change
    const targetProfile = await authServiceClient.getUserProfiles([targetUserId]);
    const snapshotName = targetProfile.get(targetUserId)?.name || targetProfile.get(targetUserId)?.username || targetUserId;

    await this._chatRepository.updateParticipantRole(groupId, targetUserId, GroupRole.ADMIN);
    
    // ✅ CRITICAL: Invalidate the conversation cache immediately
    // This allows findConversationById to see the new role in subsequent authorization checks
    await RedisCacheService.invalidateConversationCache(groupId);

    // ✅ Inject SYSTEM message via Saga for reliable broadcasting (Blocking)
    await this._messageSagaService.sendSystemMessage(
        groupId,
        `promoted_admin:${JSON.stringify({ id: targetUserId, name: snapshotName })}`,
        adminId
    );

    await this.publishEvent(groupId, 'role_updated', {
        conversationId: groupId,
        userId: targetUserId,
        role: 'ADMIN'
    });
  }

  async demoteToMember(groupId: string, adminId: string, targetUserId: string): Promise<void> {
    const { isOwner, isAdmin } = await this.verifyAdmin(adminId, groupId);
    
    // Only Owner can demote an Admin
    if (!isOwner) {
        throw new AppError("Only the group owner can demote admins", 403);
    }

    // Cannot demote self if owner (must transfer ownership first)
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (conversation?.ownerId === targetUserId) {
        throw new AppError("Owner cannot be demoted. Transfer ownership first.", 403);
    }

    const targetProfile = await authServiceClient.getUserProfiles([targetUserId]);
    const snapshotName = targetProfile.get(targetUserId)?.name || targetProfile.get(targetUserId)?.username || targetUserId;

    await this._chatRepository.updateParticipantRole(groupId, targetUserId, GroupRole.MEMBER);
    
    // ✅ Invalidate cache for immediate privilege revocation
    await RedisCacheService.invalidateConversationCache(groupId);

    // ✅ Inject SYSTEM message via Saga (Blocking)
    await this._messageSagaService.sendSystemMessage(
        groupId,
        `demoted_admin:${JSON.stringify({ id: targetUserId, name: snapshotName })}`,
        adminId
    );

    await this.publishEvent(groupId, 'role_updated', {
        conversationId: groupId,
        userId: targetUserId,
        role: 'MEMBER'
    });
  }

  async updateGroupInfo(
    groupId: string, 
    adminId: string, 
    data: { 
      name?: string; 
      description?: string; 
      icon?: string;
      onlyAdminsCanPost?: boolean;
      onlyAdminsCanEditInfo?: boolean;
    }
  ): Promise<Conversation> {
    // Check permission: if onlyAdminsCanEditInfo is true, only admins can edit
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (!conversation) throw new AppError("Group not found", 404);
    
    const { isAdmin, isOwner } = await this.verifyAdmin(adminId, groupId);

    if (conversation.onlyAdminsCanEditInfo) {
      if (!isAdmin && !isOwner) {
        throw new AppError("Only admins can edit group info", 403);
      }
    }
    
    // Permission changes always require admin
    if (data.onlyAdminsCanPost !== undefined || data.onlyAdminsCanEditInfo !== undefined) {
      if (!isAdmin && !isOwner) {
        throw new AppError("Only admins can change group permissions", 403);
      }
    }
    
    const updated = await this._chatRepository.updateGroupMetadata(groupId, data);

    // ✅ Optional: Inject SYSTEM message for group info updates (e.g., changed name)
    // For now we'll just publish the event so the UI updates
    
    this.publishEvent(groupId, 'group_updated', {
        conversationId: groupId,
        updates: data,
        updatedBy: adminId
    });

    return updated;
  }

  async leaveGroup(groupId: string, userId: string): Promise<void> {
    const participant = await this._chatRepository.findParticipantInConversation(userId, groupId);
    if (!participant) throw new AppError("You are not a member of this group", 400);
    
    // Admin transfer logic
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (conversation && conversation.type === 'GROUP') {
        const isOnlyAdmin = participant.role === GroupRole.ADMIN && 
            conversation.participants.filter(p => p.role === GroupRole.ADMIN).length === 1;
            
        if (isOnlyAdmin) {
            const otherMembers = conversation.participants.filter(p => p.userId !== userId);
            if (otherMembers.length > 0) {
                // Find oldest member
                otherMembers.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
                const newAdmin = otherMembers[0];
                
                await this._chatRepository.updateParticipantRole(groupId, newAdmin.userId, GroupRole.ADMIN);
                
                const newAdminProfileMap = await authServiceClient.getUserProfiles([newAdmin.userId]);
                const newAdminName = newAdminProfileMap.get(newAdmin.userId)?.name || newAdminProfileMap.get(newAdmin.userId)?.username || 'Unknown User';

                // ✅ Inject SYSTEM message for auto-promotion via Saga (Blocking)
                await this._messageSagaService.sendSystemMessage(
                    groupId,
                    `promoted_admin:${JSON.stringify({ id: newAdmin.userId, name: newAdminName })}`,
                    userId // Leaving user triggered this
                );

                await this.publishEvent(groupId, 'role_updated', {
                    conversationId: groupId,
                    userId: newAdmin.userId,
                    role: 'ADMIN'
                });
            }
        }
    }

    await this._chatRepository.removeParticipantFromGroup(groupId, userId);

    const userProfileMap = await authServiceClient.getUserProfiles([userId]);
    const snapshotName = userProfileMap.get(userId)?.name || userProfileMap.get(userId)?.username || 'Unknown User';

    // ✅ Inject SYSTEM message via Saga (Blocking)
    await this._messageSagaService.sendSystemMessage(
        groupId,
        `left_group:${JSON.stringify({ id: userId, name: snapshotName })}`,
        userId
    );

    // Update member count atomically
    const newMemberCount = await this._chatRepository.updateMemberCount(groupId, -1);

    this.publishEvent(groupId, 'participant_left', {
      conversationId: groupId,
      userId: userId,
      memberCount: newMemberCount
    });
  }


  private async publishEvent(conversationId: string, type: string, data: any) {
      try {
          const payload = JSON.stringify({
              type,
              data
          });
          await redisPublisher.publish(`chat:${conversationId}`, payload);
          logger.info(`Published group event: ${type}`, { conversationId });
      } catch (error) {
          logger.error(`Failed to publish group event: ${type}`, { error: (error as Error).message });
      }
  }

  /**
   * Join a public group (self-join without admin approval)
   * Regular users can add themselves to public groups
   */
   async joinGroup(groupId: string, userId: string): Promise<{ status: 'JOINED' | 'REQUEST_PENDING' }> {
    // 1. Verify hub exists
    const group = await this._chatRepository.findConversationById(groupId);
    if (!group || group.type !== 'GROUP') {
      throw new AppError("Hub not found", 404);
    }

    // 2. Check if already a member
    const existingMember = await this._chatRepository.findParticipantInConversation(userId, groupId);
    if (existingMember) {
      throw new AppError("You are already a member of this hub", 400);
    }

     // 3. Check for existing pending request to avoid duplicates
     const existingRequest = await this._hubJoinRequestRepository.findPendingRequest(groupId, userId);
     if (existingRequest) {
       logger.info("Join request already exists and is pending", { groupId, userId });
       return { status: 'REQUEST_PENDING' };
     }
 
     // 4. Create PENDING request
     const request = await this._hubJoinRequestRepository.create({
       hubId: groupId,
       requesterId: userId,
       ownerId: group.ownerId || "",
     });
 
     // 5. Emit event for Notifications/Owners
     await publishChatEvent({
       eventType: "HubJoinRequested",
       hubId: groupId,
       requesterId: userId,
       ownerId: group.ownerId,
       requestId: request.id,
     });
 
     logger.info("Hub join request created via joinGroup", { hubId: groupId, userId, requestId: request.id });
     return { status: 'REQUEST_PENDING' };
   }
}
