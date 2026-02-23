import { HubJoinRequest, JoinRequestStatus } from "@prisma/client";

export interface IHubJoinRequestRepository {
  findById(id: string): Promise<HubJoinRequest | null>;
  findPendingRequest(hubId: string, requesterId: string): Promise<HubJoinRequest | null>;
  findPendingRequestsByUser(userId: string, hubIds: string[]): Promise<HubJoinRequest[]>;
  findPendingByHub(hubId: string): Promise<HubJoinRequest[]>;
  create(data: {
    hubId: string;
    requesterId: string;
    ownerId: string;
  }): Promise<HubJoinRequest>;
  updateStatus(
    id: string,
    status: JoinRequestStatus,
    resolvedBy: string,
    version: number
  ): Promise<HubJoinRequest>;
  cancelRequest(id: string, requesterId: string, version: number): Promise<HubJoinRequest>;
}
