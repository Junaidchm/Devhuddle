import {
  IPostRepository,
  PostSelectOptions,
} from "../interface/IPostRepository";
import { BaseRepository } from "./base.repository";
import { prisma } from "../../config/prisma.config";
import logger from "../../utils/logger.util";
import redisClient from "../../config/redis.config";
import { posts, Prisma } from ".prisma/client";
import { resolve } from "path";
import { userClient } from "../../config/grpc.client";
import { response } from "express";
import {
  DeletePostResponse,
  SubmitPostRequest,
  SubmitPostResponse,
} from "../../grpc/generated/post";
import { error } from "console";
import { v4 as uuidv4 } from "uuid";
import { validateMediaOwnership, linkMediaToPost } from "../../config/media.client";

export class PostRepository
  extends BaseRepository<
    typeof prisma.posts,
    posts,
    Prisma.postsCreateInput,
    Prisma.postsUpdateInput,
    Prisma.postsWhereInput
  >
  implements IPostRepository
{
  constructor() {
    super(prisma.posts);
  }

  async createPostLogics(
    data: Partial<Prisma.postsCreateInput>
  ): Promise<{ postId: string }> {
    try {
      const { id: postId } = await super.create(data);
      return { postId };
    } catch (error: any) {
      logger.error("Error creating entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async submitPostRepo(data: SubmitPostRequest): Promise<SubmitPostResponse> {
    try {
      /**
       * ✅ UPDATED: Use Media Service for validation and linking
       * 
       * Why this change:
       * - Media Service is the single source of truth for media records
       * - Ensures consistency across services
       * - Removes dependency on Post Service's Media table
       * - Better separation of concerns
       */

      // Step 1: Validate media ownership via Media Service
      // This ensures:
      // - Media exists in Media Service
      // - Media belongs to the user creating the post
      // - Media is not already linked to another post
      if (data.mediaIds && data.mediaIds.length > 0) {
        try {
          const validation = await validateMediaOwnership(data.mediaIds, data.userId);
          
          if (!validation.valid) {
            throw new Error(
              validation.message || 
              `Invalid media: ${validation.invalidMediaIds?.join(", ")}`
            );
          }
        } catch (error: any) {
          logger.error("Media validation failed", {
            error: error.message,
            mediaIds: data.mediaIds,
            userId: data.userId,
          });
          throw new Error(`Media validation failed: ${error.message}`);
        }
      }

      // Step 2: Create post in database (transaction ensures atomicity)
      const post = await prisma.$transaction(async (tx) => {
        // Create post with generated ID
        const newPost = await tx.posts.create({
          data: {
            id: uuidv4(), // Generate ID using UUID v4
            content: data.content,
            userId: data.userId,
            visibility: data.visibility as any, // Will be properly typed after proto update
            commentControl: data.commentControl as any, // Will be properly typed after proto update
          } as any, // Type assertion for postsCreateInput
        });

        // Step 3: Link media to post via Media Service
        // This updates the Media Service database (source of truth)
        if (data.mediaIds && data.mediaIds.length > 0) {
          try {
            await linkMediaToPost(data.mediaIds, newPost.id, data.userId);
            logger.info("Media linked to post via Media Service", {
              postId: newPost.id,
              mediaIds: data.mediaIds,
            });
          } catch (error: any) {
            logger.error("Failed to link media to post", {
              error: error.message,
              postId: newPost.id,
              mediaIds: data.mediaIds,
            });
            // If linking fails, we should rollback the post creation
            // But since we're outside the transaction, we'll throw an error
            // The transaction will be rolled back automatically
            throw new Error(`Failed to link media: ${error.message}`);
          }
        }

        // Fetch post (without media from Post Service database)
        // Media will be fetched from Media Service when needed
        const postWithMedia = await tx.posts.findUnique({
          where: { id: newPost.id },
        });

        return postWithMedia!;
      }, {
        timeout: 10000, // 10 second timeout
        maxWait: 5000, // Maximum wait time for transaction
      });

      return post;
    } catch (error: any) {
      logger.error("Error creating post", {
        error: (error as Error).message,
        stack: (error as Error).stack,
        userId: data.userId,
        mediaIds: data.mediaIds,
      });
      throw new Error(error.message || "Database error");
    }
  }

  async findPost(postId: string): Promise<posts | null> {
    try {
      const post = await prisma.posts.findUnique({
        where: {
          id: postId,
        },
      });
      return post;
    } catch (error: any) {
      logger.error("Error find entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async deletePost(postId: string) {
    try {
      const post = await prisma.posts.delete({
        where: {
          id: postId,
        },
      });

      return post;
    } catch (error: any) {
      logger.error("Error delete entity", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getPostsRepo(postSelectOptions: PostSelectOptions): Promise<any> {
    try {
      // ✅ FIX: Cast to Prisma's expected type - PostSelectOptions uses skip-based pagination (no cursor)
      const prismaOptions: Prisma.postsFindManyArgs = {
        include: postSelectOptions.include,
        take: postSelectOptions.take,
        skip: postSelectOptions.skip,
        orderBy: postSelectOptions.orderBy,
        where: postSelectOptions.where,
      };
      const posts = await prisma.posts.findMany(prismaOptions);

      // console.log('this is the fetched data .......', posts)

      const enrichedPosts = await Promise.all(
        posts.map(
          (post) =>
            new Promise((resolve, reject) => {
              userClient.getUserForFeedListing(
                { userId: post.userId },
                (err, response) => {
                  // if (err) {
                  //   console.error("gRPC error fetching user:", err);
                  //   return resolve({ ...post, user: undefined });
                  // }
                  resolve({
                    ...post,
                    user: {
                      avatar: response.avatar,
                      name: response.name,
                      username: response.username,
                    },
                  });
                }
              );
            })
        )
      );

      return enrichedPosts;
    } catch (err: any) {
      logger.error("Error fetching the posts ", {
        error: (err as Error).message,
      });
      throw new Error("Database error");
    }
  }


  async incrementLikesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          likesCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing likes count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }


  async decrementLikesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          likesCount: {
            decrement: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error decrementing likes count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementCommentsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          commentsCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing comments count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async decrementCommentsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          commentsCount: {
            decrement: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error decrementing comments count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementSharesCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          sharesCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing shares count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async incrementReportsCount(postId: string): Promise<void> {
    try {
      await prisma.posts.update({
        where: { id: postId },
        data: {
          reportsCount: {
            increment: 1,
          },
        },
      });
    } catch (error: any) {
      logger.error("Error incrementing reports count", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async updatePost(postId: string, data: Partial<Prisma.postsUpdateInput>): Promise<posts> {
    try {
      return await prisma.posts.update({
        where: { id: postId },
        data,
      });
    } catch (error: any) {
      logger.error("Error updating post", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Database error");
    }
  }

  async lockForEditing(postId: string): Promise<void> {
    try {
      // Use Redis for distributed locking
      const lockKey = `post:edit:lock:${postId}`;
      // Try to set with NX (only if not exists) and EX (expiration)
      // Redis v5+ uses SET with options
      const result: string | null = await redisClient.set(lockKey, "1", {
        EX: 300, // 5 minute expiration
        NX: true, // Only set if not exists
      } as any);

      // Redis SET with NX returns "OK" if set, null if key exists
      if (result !== "OK") {
        throw new Error("Post is currently being edited");
      }

      // Also update DB flag
      await prisma.posts.update({
        where: { id: postId },
        data: { isEditing: true },
      });
    } catch (error: any) {
      logger.error("Error locking post for editing", {
        error: (error as Error).message,
        postId,
      });
      throw error;
    }
  }

  async unlockEditing(postId: string): Promise<void> {
    try {
      const lockKey = `post:edit:lock:${postId}`;
      await redisClient.del(lockKey);
      
      await prisma.posts.update({
        where: { id: postId },
        data: { isEditing: false },
      });
    } catch (error: any) {
      logger.error("Error unlocking post for editing", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Database error");
    }
  }

  // ✅ NEW: Get posts by IDs (for feed retrieval)
  async getPostsByIds(postIds: string[]): Promise<posts[]> {
    try {
      if (postIds.length === 0) {
        return [];
      }

      const posts = await prisma.posts.findMany({
        where: {
          id: { in: postIds },
          deletedAt: null, // Exclude soft-deleted posts
          isHidden: false, // Exclude hidden posts
        },
        include: {
            Media: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return posts;
    } catch (error: any) {
      logger.error("Error getting posts by IDs", {
        error: (error as Error).message,
        postCount: postIds.length,
      });
      throw new Error("Database error");
    }
  }

}
