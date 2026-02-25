import { Conversation, Participant } from "@prisma/client";

export interface GetHubsParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export type AdminHub = Conversation & {
  participants: Participant[];
  reportsCount: number;
};

export interface IAdminService {
  getHubs(params: GetHubsParams): Promise<{ hubs: AdminHub[]; total: number }>;
  getReportedHubs(params: { page: number; limit: number; search?: string }): Promise<{ hubs: AdminHub[]; total: number }>;
  getHubById(hubId: string): Promise<AdminHub>;
  suspendHub(hubId: string, suspend: boolean, reason?: string, adminId?: string): Promise<Conversation>;
  deleteHub(hubId: string, adminId?: string): Promise<void>;
  getHubStats(): Promise<{
    totalHubs: number;
    reportedHubs: number;
    suspendedHubs: number;
    deletedHubs: number;
  }>;
}
