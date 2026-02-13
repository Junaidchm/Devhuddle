import { Conversation, GroupRole, Participant } from "@prisma/client";
import { IGroupService } from "../interfaces/IGroupService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { AppError } from "../../utils/AppError";
import { authServiceClient } from "../../clients/auth-service.client";
import { ConversationWithMetadataDto } from "../../dtos/chat-service.dto";

import { redisPublisher } from "../../config/redis.config";
import logger from "../../utils/logger.util";

export class GroupService implements IGroupService {
  constructor(private _chatRepository: IChatRepository) {}

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
        unreadCount: 0
    };

    // Emit event
    this.publishEvent(conversation.id, 'group_created', enrichedConversation);

    return enrichedConversation;
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
        unreadCount: 0
    }));
  }

  async getGroupDetails(groupId: string): Promise<Conversation & { participants: Participant[] }> {
    const conversation = await this._chatRepository.findConversationById(groupId);
    if (!conversation) throw new AppError("Group not found", 404);
    if (conversation.type !== "GROUP") throw new AppError("Not a group conversation", 400);
    return conversation as Conversation & { participants: Participant[] };
  }

  async addParticipants(groupId: string, adminId: string, userIds: string[]): Promise<void> {
    await this.verifyAdmin(groupId, adminId);
    
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

        this.publishEvent(groupId, 'participants_added', {
            conversationId: groupId,
            addedBy: adminId,
            participants: addedParticipants
        });
    }
  }

  async removeParticipant(groupId: string, adminId: string, targetUserId: string): Promise<void> {
    await this.verifyAdmin(groupId, adminId);
    
    if (adminId === targetUserId) {
        throw new AppError("Admins cannot remove themselves via this endpoint, use leaveGroup instead", 400);
    }

    // Check if target is an admin
    const conversation = await this._chatRepository.findConversationById(groupId);
    const targetParticipant = conversation?.participants.find(p => p.userId === targetUserId);
    const actorParticipant = conversation?.participants.find(p => p.userId === adminId);
    
    // Allow Owner to remove anyone (except themselves, handled above).
    // Allow Admin to remove Member.
    // BLOCK Admin removing Admin.
    const isOwner = conversation?.ownerId === adminId;
    if (!isOwner && targetParticipant?.role === GroupRole.ADMIN) {
        throw new AppError("Cannot remove an admin. Demote them first.", 403);
    }

    await this._chatRepository.removeParticipantFromGroup(groupId, targetUserId);

    this.publishEvent(groupId, 'participant_removed', {
        conversationId: groupId,
        removedUserId: targetUserId,
        removedBy: adminId
    });
  }

  async promoteToAdmin(groupId: string, adminId: string, targetUserId: string): Promise<void> {
     // Check for orphaned group (self-claim)
     if (adminId === targetUserId) {
        const conversation = await this._chatRepository.findConversationById(groupId);
        const hasAdmin = conversation?.participants.some(p => p.role === GroupRole.ADMIN);
        const hasOwner = !!conversation?.ownerId;
        
        if (!hasAdmin && !hasOwner) {
            // Allow self-promotion for orphaned groups
            await this._chatRepository.updateParticipantRole(groupId, targetUserId, GroupRole.ADMIN);
             await this.publishEvent(groupId, 'role_updated', {
                 conversationId: groupId,
                 userId: targetUserId,
                 role: 'ADMIN'
             });
             return;
        }
     }

     await this.verifyAdmin(groupId, adminId);
     await this._chatRepository.updateParticipantRole(groupId, targetUserId, GroupRole.ADMIN);

     await this.publishEvent(groupId, 'role_updated', {
         conversationId: groupId,
         userId: targetUserId,
         role: 'ADMIN'
     });
  }

  async demoteToMember(groupId: string, adminId: string, targetUserId: string): Promise<void> {
    await this.verifyAdmin(groupId, adminId);
    
    // Verify we are not demoting the last admin
    if (adminId !== targetUserId) { // If demoting someone else, check if they are the last admin
        // Actually, logic is: Count admins. If count is 1 and that one is the target, deny.
        const conversation = await this._chatRepository.findConversationById(groupId);
        const adminCount = conversation?.participants.filter(p => p.role === GroupRole.ADMIN).length || 0;
        
        // If target is an admin (checked by role update logic generally, but safe to check here)
        // If there is only 1 admin, we can't demote them.
        if (adminCount <= 1) {
             const participantToDemote = conversation?.participants.find(p => p.userId === targetUserId);
             if (participantToDemote?.role === GroupRole.ADMIN) {
                 throw new AppError("Cannot demote the last admin. Promote someone else first.", 400);
             }
        }
    }

    await this._chatRepository.updateParticipantRole(groupId, targetUserId, GroupRole.MEMBER);

    this.publishEvent(groupId, 'role_updated', {
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
    
    if (conversation.onlyAdminsCanEditInfo) {
      await this.verifyAdmin(groupId, adminId);
    }
    
    // Permission changes always require admin
    if (data.onlyAdminsCanPost !== undefined || data.onlyAdminsCanEditInfo !== undefined) {
      await this.verifyAdmin(groupId, adminId);
    }
    
    const updated = await this._chatRepository.updateGroupMetadata(groupId, data);

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
    
    await this._chatRepository.removeParticipantFromGroup(groupId, userId);

    this.publishEvent(groupId, 'participant_left', {
        conversationId: groupId,
        userId: userId
    });
  }

  private async verifyAdmin(groupId: string, userId: string): Promise<void> {
      const participant = await this._chatRepository.findParticipantInConversation(userId, groupId);
      if (!participant) {
          throw new AppError("User is not a participant of this group", 403);
      }
      
      // ✅ Check admin role OR owner status (defensive check to ensure owners can always manage)
      const conversation = await this._chatRepository.findConversationById(groupId);
      if (participant.role !== GroupRole.ADMIN && conversation?.ownerId !== userId) {
          throw new AppError("Only admins can perform this action", 403);
      }
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
  async joinGroup(groupId: string, userId: string): Promise<void> {
    // Verify group exists
    const group = await this._chatRepository.findConversationById(groupId);
    if (!group || group.type !== 'GROUP') {
      throw new AppError("Group not found", 404);
    }

    // Check if user is already a participant
    const existing = await this._chatRepository.findParticipantInConversation(userId, groupId);
    if (existing) {
      return; // Already a member, silently succeed
    }

    // Add user as a participant with MEMBER role
    await this._chatRepository.addParticipantToGroup(groupId, userId);

    // Enrich user profile and publish event
    const userProfilesMap = await authServiceClient.getUserProfiles([userId]);
    const userProfile = userProfilesMap.get(userId);

    this.publishEvent(groupId, 'participant_joined', {
      conversationId: groupId,
      participant: {
        userId: userId,
        username: userProfile?.username || 'unknown',
        name: userProfile?.name || 'Unknown User',
        profilePhoto: userProfile?.profilePhoto || null,
        role: 'MEMBER'
      }
    });

    logger.info(`User ${userId} joined group ${groupId}`);
  }
}
