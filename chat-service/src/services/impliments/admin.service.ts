import { IAdminService, GetHubsParams } from "../interfaces/IAdminService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { Conversation, Participant, Prisma } from "@prisma/client";
import logger from "../../utils/logger.util";

export class AdminService implements IAdminService {
  constructor(private readonly _chatRepository: IChatRepository) {}

  async getHubs(params: GetHubsParams): Promise<{ hubs: (Conversation & { participants: Participant[] })[]; total: number }> {
    try {
      const { page, limit, search } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ConversationWhereInput = {
        type: 'GROUP',
        deletedAt: null
      };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const hubs = await this._chatRepository.findAllGroups(
          search,
          [],
          limit,
          skip
      );

      const total = await this._chatRepository.getConversationCount(where);

      return { hubs, total };
    } catch (error: unknown) {
      logger.error("AdminService.getHubs Error", { error });
      throw error;
    }
  }

  async getReportedHubs(params: { page: number; limit: number }): Promise<{ hubs: (Conversation & { participants: Participant[] })[]; total: number }> {
    try {
      const { page, limit } = params;
      const skip = (page - 1) * limit;

      const where: Prisma.ConversationWhereInput = {
        type: 'GROUP',
        deletedAt: null,
        reports: {
            some: {}
        }
      };

      const hubs = await this._chatRepository.findAllGroups(
          undefined,
          [],
          limit,
          skip
      );
      
      const total = await this._chatRepository.getConversationCount(where);

      return { hubs, total };
    } catch (error: unknown) {
      logger.error("AdminService.getReportedHubs Error", { error });
      throw error;
    }
  }

  async suspendHub(hubId: string, suspend: boolean): Promise<Conversation> {
    try {
      return await this._chatRepository.updateConversation(hubId, {
          isSuspended: suspend,
          suspendedAt: suspend ? new Date() : null
      });
    } catch (error: unknown) {
      logger.error("AdminService.suspendHub Error", { error });
      throw error;
    }
  }

  async deleteHub(hubId: string): Promise<void> {
    try {
        await this._chatRepository.updateConversation(hubId, {
            deletedAt: new Date()
        });
    } catch (error: unknown) {
      logger.error("AdminService.deleteHub Error", { error });
      throw error;
    }
  }
}
