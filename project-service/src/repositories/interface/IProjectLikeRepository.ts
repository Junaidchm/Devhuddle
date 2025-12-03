import { ProjectLike } from "@prisma/client";

export interface CreateProjectLikeData {
  projectId: string;
  userId: string;
}

export interface IProjectLikeRepository {
  createLike(data: CreateProjectLikeData): Promise<ProjectLike>;
  deleteLike(projectId: string, userId: string): Promise<void>;
  findLike(projectId: string, userId: string): Promise<ProjectLike | null>;
  findSoftDeletedLike(projectId: string, userId: string): Promise<ProjectLike | null>;
  restoreLike(likeId: string): Promise<ProjectLike>;
  getLikeCount(projectId: string): Promise<number>;
  getUserLikesForProjects(userId: string, projectIds: string[]): Promise<Record<string, boolean>>;
}

