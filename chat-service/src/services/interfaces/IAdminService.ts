import { Conversation, Participant, Report } from "@prisma/client";

export interface GetHubsParams {
  page: number;
  limit: number;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IAdminService {
  getHubs(params: GetHubsParams): Promise<{ hubs: (Conversation & { participants: Participant[] })[]; total: number }>;
  getReportedHubs(params: { page: number; limit: number }): Promise<{ hubs: (Conversation & { participants: Participant[] })[]; total: number }>;
  suspendHub(hubId: string, suspend: boolean): Promise<Conversation>;
  deleteHub(hubId: string): Promise<void>;
}
