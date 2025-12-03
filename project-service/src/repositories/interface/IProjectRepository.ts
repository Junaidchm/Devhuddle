import { Prisma } from "@prisma/client";

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
  createProject(data: CreateProjectData): Promise<any>;
  updateProject(projectId: string, data: Partial<CreateProjectData>): Promise<any>;
  getProjectById(projectId: string, userId?: string): Promise<any>;
  listProjects(options: ProjectSelectOptions): Promise<any[]>;
  getTrendingProjects(options: ProjectSelectOptions): Promise<any[]>;
  getTopProjects(options: ProjectSelectOptions): Promise<any[]>;
  searchProjects(query: string, filters: any): Promise<any[]>;
  deleteProject(projectId: string, userId: string): Promise<any>;
  publishProject(projectId: string, userId: string): Promise<any>;
  incrementViews(projectId: string): Promise<void>;
  updateTrendingScore(projectId: string, score: number): Promise<void>;
  findProject(projectId: string): Promise<any | null>;
}

