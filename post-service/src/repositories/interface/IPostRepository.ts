import { posts, Prisma } from ".prisma/client";
import {
  SubmitPostRequest,
  SubmitPostResponse,
} from "../../grpc/generated/post";

export interface PostSelectOptions {
  include: any;
  take: number;
  orderBy: {
    id?: "asc" | "desc";
    createdAt?: "asc" | "desc";
  };
  skip?: number;
  where?: any;
  // Removed cursor - using skip-based pagination for simplicity
}

import { EnrichedPost } from "../../types/common.types";

export interface IPostRepository {
  createPostLogics(
    data: Partial<Prisma.postsCreateInput>
  ): Promise<{ postId: string }>;
  getPostsRepo(postSelectOptions: PostSelectOptions): Promise<EnrichedPost[]>;
  submitPostRepo(data: SubmitPostRequest): Promise<SubmitPostResponse>;
  findPost(postId: string): Promise<posts | null>;
  deletePost(postId: string): Promise<any>;
  // Counter update methods
  incrementLikesCount(postId: string): Promise<void>;
  decrementLikesCount(postId: string): Promise<void>;
  incrementCommentsCount(postId: string): Promise<void>;
  decrementCommentsCount(postId: string): Promise<void>;
  incrementSharesCount(postId: string): Promise<void>;
  incrementReportsCount(postId: string): Promise<void>;
  updatePost(postId: string, data: Partial<Prisma.postsUpdateInput>): Promise<posts>;
  lockForEditing(postId: string): Promise<void>;
  unlockEditing(postId: string): Promise<void>;
  // ✅ NEW: Get posts by IDs (for feed retrieval)
  getPostsByIds(postIds: string[]): Promise<posts[]>;
}
