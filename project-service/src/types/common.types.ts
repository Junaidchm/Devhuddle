// gRPC callback types
export interface GrpcError {
  code: number;
  details: string;
  metadata: unknown;
}

export interface UserResponse {
  userId: string;
  name: string;
  username: string;
  avatar: string;
}

// Search filters
export interface ProjectSearchFilters {
  category?: string;
  tags?: string[];
  status?: string;
  [key: string]: unknown;
}

// Outbox event payload
export interface OutboxEventPayload {
  [key: string]: unknown;
}

// Idempotency response
export interface IdempotencyResponse {
  [key: string]: unknown;
}

import { Project, ProjectMedia } from "@prisma/client";

// Project Media and Engagement
export interface ProjectEngagement {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  viewsCount: number;
  isLiked?: boolean;
  isShared?: boolean;
}

export interface ProjectAuthor {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

// Project with user enrichment
export interface EnrichedProject extends Project {
  media: ProjectMedia[];
  engagement?: ProjectEngagement;
  author: ProjectAuthor | null;
  [key: string]: unknown;
}
