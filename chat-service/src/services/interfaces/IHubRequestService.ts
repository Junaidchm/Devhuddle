import { HubJoinRequest } from "@prisma/client";

export interface IHubRequestService {
  requestToJoin(hubId: string, userId: string): Promise<HubJoinRequest>;
  approveRequest(requestId: string, adminId: string): Promise<HubJoinRequest>;
  rejectRequest(requestId: string, adminId: string): Promise<HubJoinRequest>;
  cancelRequest(requestId: string, userId: string): Promise<HubJoinRequest>;
  getPendingRequestsForHub(hubId: string, adminId: string): Promise<HubJoinRequest[]>;
  getPendingRequestsForUser(userId: string): Promise<HubJoinRequest[]>;
}
