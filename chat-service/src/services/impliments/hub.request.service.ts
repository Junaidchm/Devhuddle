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

export class HubRequestService implements IHubRequestService {
  constructor(
    private _hubJoinRequestRepository: IHubJoinRequestRepository,
    private _chatRepository: IChatRepository
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
    const request = await this._hubJoinRequestRepository.findById(requestId);
    if (!request) throw new AppError("Request not found", 404);

    if (request.status !== JoinRequestStatus.PENDING) {
      throw new AppError(`Cannot approve request in ${request.status} status`, 400);
    }

    // Verify admin is owner or admin of the hub
    const conversation = await this._chatRepository.findConversationById(request.hubId);
    if (!conversation) throw new AppError("Hub not found", 404);

    const isAdmin = conversation.participants.some(p => p.userId === adminId && p.role === 'ADMIN');
    const isOwner = conversation.ownerId === adminId;

    if (!isAdmin && !isOwner) {
      throw new AppError("Only owners or admins can approve join requests", 403);
    }

    // Atomic transition with versioning
    const updated = await this._hubJoinRequestRepository.updateStatus(
      requestId,
      JoinRequestStatus.APPROVED,
      adminId,
      request.version
    );

    // 3. DIRECT ACTIVATION: Add user to group immediately (Fallback/UX)
    try {
      const existing = await this._chatRepository.findParticipantInConversation(request.requesterId, request.hubId);
      if (!existing) {
        await this._chatRepository.addParticipantToGroup(request.hubId, request.requesterId);
        await RedisCacheService.invalidateConversationCache(request.hubId);
        logger.info(`Directly activated member ${request.requesterId} in hub ${request.hubId}`);
      }
    } catch (err) {
      logger.error("Failed direct membership activation", { err });
      // Don't fail the whole request if activation fails (consumer might retry)
    }

    // 4. Emit event for long-term notification & other side effects
    await publishChatEvent({
      eventType: "HubJoinApproved",
      requestId: request.id,
      hubId: request.hubId,
      hubName: conversation.name || "Group",
      requesterId: request.requesterId,
      resolvedBy: adminId,
    });

    logger.info("Hub join request approved", { requestId, adminId });

    // Broadcast real-time update to Requester
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
