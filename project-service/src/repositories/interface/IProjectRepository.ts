import { Project } from "@prisma/client";
import { EnrichedProject } from "../../types/common.types";

export interface ProjectSelectOptions {
  include?: any;
  take?: number;
  skip?: number;
  cursor?: { id: string };
  orderBy?: any;
  where?: any;
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
  searchProjects(query: string, filters: any): Promise<EnrichedProject[]>;
  deleteProject(projectId: string, userId: string): Promise<Project>;
  publishProject(projectId: string, userId: string): Promise<Project>;
  incrementViews(projectId: string): Promise<void>;
  updateTrendingScore(projectId: string, score: number): Promise<void>;
  findProject(projectId: string): Promise<Project | null>;
}

