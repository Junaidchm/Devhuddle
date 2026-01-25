/**
 * Response DTO for a project
 */
export interface ProjectResponseDto {
  id: string;
  userId: string;
  title: string;
  description: string;
  repositoryUrls?: string[];
  demoUrl?: string;
  techStack?: string[];
  tags?: string[];
  visibility: string;
  mediaIds?: string[];
  likeCount?: number;
  viewCount?: number;
  createdAt: Date;
  updatedAt: Date;
}
