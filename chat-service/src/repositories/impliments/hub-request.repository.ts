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
    return await prisma.hubJoinRequest.findFirst({
      where: {
        hubId,
        requesterId,
        status: JoinRequestStatus.PENDING,
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
      const result = await prisma.hubJoinRequest.updateMany({
        where: {
          id,
          version,
        },
        data: {
          status,
          resolvedBy,
          resolvedAt: new Date(),
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new AppError("Request not found, already processed, or version mismatch", 409);
      }

      const updated = await this.findById(id);
      if (!updated) throw new AppError("Request no longer exists", 404);
      return updated;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  }

  async cancelRequest(id: string, requesterId: string, version: number): Promise<HubJoinRequest> {
    try {
      const result = await prisma.hubJoinRequest.updateMany({
        where: {
          id,
          requesterId,
          version,
        },
        data: {
          status: JoinRequestStatus.CANCELLED,
          version: { increment: 1 },
        },
      });

      if (result.count === 0) {
        throw new AppError("Request not found, unauthorized, or version mismatch", 403);
      }

      const updated = await this.findById(id);
      if (!updated) throw new AppError("Request no longer exists", 404);
      return updated;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      throw error;
    }
  }
}
