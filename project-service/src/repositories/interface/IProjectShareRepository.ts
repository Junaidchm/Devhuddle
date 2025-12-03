import { ProjectShare } from "@prisma/client";

export interface CreateProjectShareData {
  projectId: string;
  userId: string;
  shareType?: string;
  caption?: string;
}

export interface IProjectShareRepository {
  createShare(data: CreateProjectShareData): Promise<ProjectShare>;
  findShare(projectId: string, userId: string): Promise<ProjectShare | null>;
  getSharesByProject(projectId: string, limit?: number): Promise<ProjectShare[]>;
  getShareCount(projectId: string): Promise<number>;
  hasShared(projectId: string, userId: string): Promise<boolean>;
  getUserSharesForProjects(userId: string, projectIds: string[]): Promise<Record<string, boolean>>;
}

