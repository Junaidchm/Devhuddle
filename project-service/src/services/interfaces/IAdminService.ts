import { Project, ProjectReport } from "@prisma/client";
import { EnrichedProject } from "../../types/common.types";

export interface GetProjectsParams {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface IAdminService {
  getProjects(params: GetProjectsParams): Promise<{ projects: EnrichedProject[]; total: number }>;
  getReportedProjects(params: { page: number; limit: number }): Promise<{ projects: EnrichedProject[]; total: number }>;
  hideProject(projectId: string, hide: boolean): Promise<Project>;
  deleteProject(projectId: string): Promise<Project>;
}
