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
      // ✅ FIXED P0-1: Wrap in transaction for atomicity
      // This ensures post and media attachments are created atomically
      // If any part fails, entire operation rolls back (no orphaned media)
      const post = await prisma.$transaction(async (tx) => {
        // Validate all media exists and is not already attached to another post
        if (data.mediaIds && data.mediaIds.length > 0) {
          const existingMedia = await tx.media.findMany({
            where: {
              id: { in: data.mediaIds },
            },
          });

          if (existingMedia.length !== data.mediaIds.length) {
            throw new Error("One or more media files not found");
          }

          // Check if any media is already attached to another post
          const attachedMedia = existingMedia.filter((m) => m.postId !== null);
          if (attachedMedia.length > 0) {
            throw new Error(
              "One or more media files are already attached to another post"
            );
          }
        }

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

        // Link media to post by updating postId
        if (data.mediaIds && data.mediaIds.length > 0) {
          await tx.media.updateMany({
            where: {
              id: { in: data.mediaIds },
            },
            data: {
              postId: newPost.id,
            },
          });
        }

        // Fetch post with media
        const postWithMedia = await tx.posts.findUnique({
          where: { id: newPost.id },
          include: {
            Media: true,
          },
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
