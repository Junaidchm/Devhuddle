import { HubJoinRequest, JoinRequestStatus } from "@prisma/client";
import { IHubRequestService } from "../interfaces/IHubRequestService";
import { IHubJoinRequestRepository } from "../../repositories/interfaces/IHubJoinRequestRepository";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { RedisCacheService } from "../../utils/redis-cache.util";
import { AppError } from "../../utils/AppError";
import { publishChatEvent } from "../../utils/kafka.util";
import { redisPublisher } from "../../config/redis.config";
import { authServiceClient } from "../../clients/auth-service.client";
import logger from "../../utils/logger.util";

import { MessageSagaService } from "./message.service";

export class HubRequestService implements IHubRequestService {
  constructor(
    private _hubJoinRequestRepository: IHubJoinRequestRepository,
    private _chatRepository: IChatRepository,
    private _messageSagaService: MessageSagaService
  ) {}

  async requestToJoin(hubId: string, userId: string): Promise<HubJoinRequest> {
    // 1. Verify hub exists
    const hub = await this._chatRepository.findConversationById(hubId);
    if (!hub || hub.type !== 'GROUP') {
      throw new AppError("Hub not found", 404);
    }

    // 2. Check if already a member
    const existingMember = await this._chatRepository.findParticipantInConversation(userId, hubId);
    if (existingMember) {
      throw new AppError("You are already a member of this hub", 400);
    }

    // 3. Check for existing pending request
    const existingRequest = await this._hubJoinRequestRepository.findPendingRequest(hubId, userId);
    if (existingRequest) {
      return existingRequest; // Silently return if already pending
    }

    // 4. Create request
    const request = await this._hubJoinRequestRepository.create({
      hubId,
      requesterId: userId,
      ownerId: hub.ownerId || "",
    });

    // 5. Identify admins to notify
    const adminIds = hub.participants
      .filter(p => p.role === 'ADMIN' || p.userId === hub.ownerId)
      .map(p => p.userId);
    
    const uniqueAdminIds = Array.from(new Set(adminIds));

    // 6. Emit event for long-term notification
    await publishChatEvent({
      eventType: "HubJoinRequested",
      hubId,
      hubName: hub.name || "Group", // Enriched metadata
      requesterId: userId,
      ownerId: hub.ownerId || "",
      adminIds: uniqueAdminIds, // Pass full list to notification service
      requestId: request.id,
    });

    // 7. Broadcast real-time update to all Admins & Owner
    await redisPublisher.publish('conversation_event', JSON.stringify({
      type: 'hub_join_requested',
      conversationId: hubId,
      targetUserIds: uniqueAdminIds, // Use specialized multi-target field
      data: {
        requestId: request.id,
        requesterId: userId,
        hubId,
        hubName: hub.name || "Group"
      }
    }));

    logger.info("Hub join request created", { hubId, userId, requestId: request.id });
    return request;
  }

  async approveRequest(requestId: string, adminId: string): Promise<HubJoinRequest> {
    logger.info("👉 [HubRequestService] Approving request", { requestId, adminId });
    
    const request = await this._hubJoinRequestRepository.findById(requestId);
    if (!request) {
      logger.error("❌ [HubRequestService] Request not found", { requestId });
      throw new AppError("Request not found", 404);
    }

    if (request.status !== JoinRequestStatus.PENDING) {
      logger.warn("⚠️ [HubRequestService] Request is not pending", { requestId, status: request.status });
      throw new AppError(`Cannot approve request in ${request.status} status`, 400);
    }

    // Verify admin is owner or admin of the hub
    const conversation = await this._chatRepository.findConversationById(request.hubId);
    if (!conversation) {
      logger.error("❌ [HubRequestService] Hub not found", { hubId: request.hubId });
      throw new AppError("Hub not found", 404);
    }

    const isAdmin = conversation.participants.some(p => p.userId === adminId && p.role === 'ADMIN');
    const isOwner = conversation.ownerId === adminId;

    logger.debug("👉 [HubRequestService] Permission check", { 
      requestId, 
      adminId, 
      isAdmin, 
      isOwner,
      ownerId: conversation.ownerId 
    });

    if (!isAdmin && !isOwner) {
      logger.warn("🚫 [HubRequestService] Unauthorized approval attempt", { requestId, adminId });
      throw new AppError("Only owners or admins can approve join requests", 403);
    }

    // Atomic transition with versioning
    logger.info("👉 [HubRequestService] Updating status to APPROVED", { requestId, version: request.version });
    const updated = await this._hubJoinRequestRepository.updateStatus(
      requestId,
      JoinRequestStatus.APPROVED,
      adminId,
      request.version
    );

    // 3. FULL ACTIVATION: Add user to group immediately (Fallback/UX)
    try {
      logger.info("👉 [HubRequestService] Attempting full direct activation", { 
        hubId: request.hubId, 
        requesterId: request.requesterId 
      });
      
      const { wasAlreadyActive } = await this._chatRepository.ensureParticipantActive(request.hubId, request.requesterId);
      
      if (!wasAlreadyActive) {
        // Update member count
        await this._chatRepository.updateMemberCount(request.hubId, 1);
        
        // Invalidate cache
        await RedisCacheService.invalidateConversationCache(request.hubId);

        // Fetch profile for system message
        const userProfilesMap = await authServiceClient.getUserProfiles([request.requesterId]);
        const userProfile = userProfilesMap.get(request.requesterId);
        const snapshotName = userProfile?.name || userProfile?.username || 'Unknown User';

        // Send group joined system message
        await this._messageSagaService.sendSystemMessage(
          request.hubId,
          `joined_group:${JSON.stringify({ id: request.requesterId, name: snapshotName })}`,
          request.requesterId
        );

        logger.info("✅ [HubRequestService] Fully activated member (direct)", { 
          requesterId: request.requesterId, 
          hubId: request.hubId 
        });
      } else {
        logger.info("ℹ️ [HubRequestService] User already an active member", { requesterId: request.requesterId });
      }
    } catch (err: any) {
      logger.error("❌ [HubRequestService] Failed direct membership activation", { 
        error: err.message,
        requestId 
      });
      // Don't fail the whole request if activation fails (consumer might retry)
    }

    // 4. Emit event for long-term notification & other side effects
    logger.info("👉 [HubRequestService] Publishing HubJoinApproved event", { requestId });
    await publishChatEvent({
      eventType: "HubJoinApproved",
      requestId: request.id,
      hubId: request.hubId,
      hubName: conversation.name || "Group",
      requesterId: request.requesterId,
      resolvedBy: adminId,
    });

    // Broadcast real-time update to Requester (so they know they were approved)
    logger.info("👉 [HubRequestService] Broadcasting real-time approval to requester", { requesterId: request.requesterId });
    await redisPublisher.publish('conversation_event', JSON.stringify({
      type: 'hub_join_approved',
      conversationId: request.hubId,
      targetUserId: request.requesterId,
      data: {
        requestId: request.id,
        hubId: request.hubId,
        status: JoinRequestStatus.APPROVED
      }
    }));

    // Broadcast participants_added to ALL group members (including admin/owner) 
    // so their member list and count refreshes in real-time without a page reload
    const allParticipantIds = conversation.participants
      .filter(p => !p.deletedAt)
      .map(p => p.userId);
    
    logger.info("👉 [HubRequestService] Broadcasting participants_added to all group members", { count: allParticipantIds.length });
    await redisPublisher.publish('conversation_event', JSON.stringify({
      type: 'participants_added',
      conversationId: request.hubId,
      targetUserIds: allParticipantIds,
      data: {
        conversationId: request.hubId,
        newParticipants: [request.requesterId],
        hubId: request.hubId,
      }
    }));

    return updated;
  }

  async rejectRequest(requestId: string, adminId: string): Promise<HubJoinRequest> {
    const request = await this._hubJoinRequestRepository.findById(requestId);
    if (!request) throw new AppError("Request not found", 404);

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new AppError("Can only reject pending requests", 400);
    }

    // Verify permissions
    const conversation = await this._chatRepository.findConversationById(request.hubId);
    const isAdmin = conversation?.participants.some(p => p.userId === adminId && p.role === 'ADMIN');
    const isOwner = conversation?.ownerId === adminId;

    if (!isAdmin && !isOwner) {
      throw new AppError("Only owners or admins can reject join requests", 403);
    }

    const updated = await this._hubJoinRequestRepository.updateStatus(
      requestId,
      JoinRequestStatus.REJECTED,
      adminId,
      request.version
    );

    // Emit event
    await publishChatEvent({
      eventType: "HubJoinRejected",
      requestId: request.id,
      hubId: request.hubId,
      hubName: conversation?.name || "Group",
      requesterId: request.requesterId,
      resolvedBy: adminId,
    });

    logger.info("Hub join request rejected", { requestId, adminId });

    // Broadcast real-time update to Requester
    await redisPublisher.publish('conversation_event', JSON.stringify({
      type: 'hub_join_rejected',
      conversationId: request.hubId,
      targetUserId: request.requesterId,
      data: {
        requestId: request.id,
        hubId: request.hubId,
        status: JoinRequestStatus.REJECTED
      }
    }));

    return updated;
  }

  async cancelRequest(requestId: string, userId: string): Promise<HubJoinRequest> {
    const request = await this._hubJoinRequestRepository.findById(requestId);
    if (!request) throw new AppError("Request not found", 404);

    if (request.requesterId !== userId) {
      throw new AppError("Not authorized to cancel this request", 403);
    }

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new AppError("Can only cancel pending requests", 400);
    }

    const updated = await this._hubJoinRequestRepository.cancelRequest(
      requestId,
      userId,
      request.version
    );

    logger.info("Hub join request cancelled by requester", { requestId, userId });
    return updated;
  }

  async getPendingRequestsForHub(hubId: string, adminId: string): Promise<HubJoinRequest[]> {
    const conversation = await this._chatRepository.findConversationById(hubId);
    if (!conversation) throw new AppError("Hub not found", 404);

    const isAdmin = conversation.participants.some(p => p.userId === adminId && p.role === 'ADMIN');
    const isOwner = conversation.ownerId === adminId;

    if (!isAdmin && !isOwner) {
      throw new AppError("Only owners or admins can view join requests", 403);
    }

    const requests = await this._hubJoinRequestRepository.findPendingByHub(hubId);
    
    if (requests.length === 0) return [];

    // Populate requester profiles
    const requesterIds = requests.map(r => r.requesterId);
    const profileMap = await authServiceClient.getUserProfiles(requesterIds);

    return requests.map(r => ({
      ...r,
      requester: profileMap.get(r.requesterId) || {
        id: r.requesterId,
        username: "unknown",
        name: "Unknown User",
        profilePhoto: null
      }
    })) as any;
  }

  async getPendingRequestsForUser(userId: string): Promise<HubJoinRequest[]> {
    // This could be implemented in repository if needed
    throw new Error("Method not implemented.");
  }
}
