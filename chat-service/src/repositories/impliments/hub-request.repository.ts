import { PrismaClient, HubJoinRequest, JoinRequestStatus } from "@prisma/client";
import { IHubJoinRequestRepository } from "../interfaces/IHubJoinRequestRepository";
import { AppError } from "../../utils/AppError";

const prisma = new PrismaClient();

export class HubJoinRequestRepository implements IHubJoinRequestRepository {
  async findById(id: string): Promise<HubJoinRequest | null> {
    return await prisma.hubJoinRequest.findUnique({
      where: { id },
    });
  }

  async findPendingRequest(hubId: string, requesterId: string): Promise<HubJoinRequest | null> {
    return await prisma.hubJoinRequest.findUnique({
      where: {
        hubId_requesterId_status: {
          hubId,
          requesterId,
          status: JoinRequestStatus.PENDING,
        },
      },
    });
  }

  async findPendingRequestsByUser(userId: string, hubIds: string[]): Promise<HubJoinRequest[]> {
    return await prisma.hubJoinRequest.findMany({
      where: {
        requesterId: userId,
        hubId: { in: hubIds },
        status: JoinRequestStatus.PENDING,
      },
    });
  }

  async findPendingByHub(hubId: string): Promise<HubJoinRequest[]> {
    return await prisma.hubJoinRequest.findMany({
      where: {
        hubId,
        status: JoinRequestStatus.PENDING,
      },
      orderBy: {
        requestedAt: "desc",
      },
    });
  }

  async create(data: {
    hubId: string;
    requesterId: string;
    ownerId: string;
  }): Promise<HubJoinRequest> {
    return await prisma.hubJoinRequest.create({
      data: {
        hubId: data.hubId,
        requesterId: data.requesterId,
        ownerId: data.ownerId,
        status: JoinRequestStatus.PENDING,
        version: 1,
      },
    });
  }

  async updateStatus(
    id: string,
    status: JoinRequestStatus,
    resolvedBy: string,
    version: number
  ): Promise<HubJoinRequest> {
    try {
      const updated = await prisma.hubJoinRequest.update({
        where: {
          id,
          version: version, // Optimistic locking
        },
        data: {
          status,
          resolvedBy,
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });
      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError("Request not found or version mismatch (Optimistic Lock Failure)", 409);
      }
      throw error;
    }
  }

  async cancelRequest(id: string, requesterId: string, version: number): Promise<HubJoinRequest> {
    try {
      const updated = await prisma.hubJoinRequest.update({
        where: {
          id,
          requesterId,
          version: version,
        },
        data: {
          status: JoinRequestStatus.CANCELLED,
          version: { increment: 1 },
        },
      });
      return updated;
    } catch (error: any) {
      if (error.code === 'P2025') {
        throw new AppError("Request not found, unauthorized, or version mismatch", 403);
      }
      throw error;
    }
  }
}
