import { Project, ProjectReport } from "@prisma/client";
import { EnrichedProject } from "../../types/common.types";

export interface GetProjectsParams {
  page: number;
  limit: number;
  status?: string;
  userId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IAdminService {
  getProjects(params: GetProjectsParams): Promise<{ projects: EnrichedProject[]; total: number }>;
  getReportedProjects(params: { page: number; limit: number; userId?: string; search?: string }): Promise<{ projects: EnrichedProject[]; total: number }>;
  getProjectById(projectId: string): Promise<EnrichedProject>;
  hideProject(projectId: string, hide: boolean, reason?: string, adminId?: string): Promise<Project>;
  deleteProject(projectId: string): Promise<Project>;
}
