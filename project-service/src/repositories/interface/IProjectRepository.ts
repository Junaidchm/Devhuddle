import { Project, Prisma } from "@prisma/client";
import { EnrichedProject } from "../../types/common.types";

export interface ProjectSelectOptions {
  include?: Prisma.ProjectInclude;
  take?: number;
  skip?: number;
  cursor?: Prisma.ProjectWhereUniqueInput;
  orderBy?: Prisma.ProjectOrderByWithRelationInput | Prisma.ProjectOrderByWithRelationInput[];
  where?: Prisma.ProjectWhereInput;
}

export interface SearchFilters {
  techStack?: string[];
  tags?: string[];
  limit?: number;
  skip?: number;
  status?: string;
}

export interface CreateProjectData {
  title: string;
  description: string;
  userId: string;
  repositoryUrls?: string[];
  demoUrl?: string;
  techStack?: string[];
  tags?: string[];
  visibility?: string;
  status?: string;
  mediaIds?: string[];
}

export interface IProjectRepository {
  createProject(data: CreateProjectData): Promise<Project>;
  updateProject(projectId: string, data: Partial<CreateProjectData>): Promise<Project>;
  getProjectById(projectId: string, userId?: string): Promise<EnrichedProject | null>;
  listProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]>;
  getTrendingProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]>;
  getTopProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]>;
  searchProjects(query: string, filters: SearchFilters): Promise<EnrichedProject[]>;
  deleteProject(projectId: string, userId: string): Promise<Project>;
  publishProject(projectId: string, userId: string): Promise<Project>;
  incrementViews(projectId: string): Promise<void>;
  trackView(projectId: string, userId?: string): Promise<boolean>;
  incrementCommentsCount(projectId: string): Promise<void>;
  decrementCommentsCount(projectId: string): Promise<void>;
  updateTrendingScore(projectId: string, score: number): Promise<void>;
  adminListProjects(options: ProjectSelectOptions): Promise<EnrichedProject[]>;
  getProjectCount(where?: Prisma.ProjectWhereInput): Promise<number>;
  findProject(projectId: string): Promise<Project | null>;
}

