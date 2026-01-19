import { ChatInteraction } from "@prisma/client";

export interface IChatInteractionRepository {
  findByUserAndPartners(
    userId: string,
    partnerIds: string[],
    sinceDate: Date
  ): Promise<ChatInteraction[]>;

  findRecentPartners(
    userId: string,
    limit: number,
    sinceDate: Date
  ): Promise<ChatInteraction[]>;
}
