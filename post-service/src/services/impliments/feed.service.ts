import { IFeedRepository } from "../../repositories/interface/IFeedRepository";
import { FeedRankingService, PostMetadata } from "./feed-ranking.service";
import { IFeedService, FanOutOptions, FeedResponse, Follower } from "../interfaces/IFeedService";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import logger from "../../utils/logger.util";
import { RedisCacheService } from "../../utils/redis.util";


export class FeedService implements IFeedService {
  private readonly FAN_OUT_THRESHOLD = 1000; // Switch to async if followers > 1000
  private readonly FEED_CACHE_TTL = 300; // 5 minutes

  constructor(
    private _feedRepository: IFeedRepository,
    private _feedRankingService: FeedRankingService,
    private _postRepository: IPostRepository
  ) {}

  /**
   * Fan-out post to followers' feeds with relevance scores
   * For < 1000 followers: synchronous
   * For > 1000 followers: should be async (handled by caller)
   */
  async fanOutToFollowers(options: FanOutOptions): Promise<void> {
    try {
      const { postId, authorId, followers, metadata } = options;

      logger.info("Starting fan-out", {
        postId,
        authorId,
        followerCount: followers.length,
      });

      // Process in batches of 100 for efficiency
      const batchSize = 100;
      const batches: Follower[][] = [];

      for (let i = 0; i < followers.length; i += batchSize) {
        batches.push(followers.slice(i, i + batchSize));
      }

      // Process batches sequentially to avoid overwhelming the system
      for (const batch of batches) {
        const feedEntries = await Promise.all(
          batch.map(async (follower) => {
            try {
              // Calculate relevance score for this follower
              const relevanceScore =
                await this._feedRankingService.calculateInitialScore(
                  authorId,
                  follower.id,
                  metadata
                );

              return {
                userId: follower.id,
                postId,
                relevanceScore,
                isRead: false,
                createdAt: new Date(),
                scoreUpdatedAt: new Date(),
              };
            } catch (error: unknown) {
              logger.error("Error calculating score for follower", {
                error: (error as Error).message,
                followerId: follower.id,
                postId,
              });
              // Return default entry with low score
              return {
                userId: follower.id,
                postId,
                relevanceScore: 0.1,
                isRead: false,
                createdAt: new Date(),
                scoreUpdatedAt: new Date(),
              };
            }
          })
        );

        // Batch insert into UserFeed table
        await this._feedRepository.batchInsertFeedEntries(feedEntries);
      }

      logger.info("Fan-out completed", {
        postId,
        followerCount: followers.length,
      });
    } catch (error: unknown) {
      logger.error("Error in fan-out process", {
        error: (error as Error).message,
        postId: options.postId,
      });
      throw new Error("Failed to fan-out post to followers");
    }
  }

  /**
   * Get personalized feed for a user (ranked by relevance)
   */
  async getFeed(
    userId: string,
    cursor?: string,
    limit: number = 10
  ): Promise<FeedResponse> {
    try {
      // Try Redis cache first
      const cacheKey = `feed:ids:${userId}:${cursor || "latest"}`;
      const cached = await RedisCacheService.get(cacheKey);
      
      let postIds: string[] = [];
      let nextCursor: string | null = null;

      if (cached) {
        logger.info("Feed ID cache hit", { userId, cursor });
        const data = JSON.parse(cached);
        postIds = data.postIds;
        nextCursor = data.nextCursor;
      } else {
        // Query UserFeed table (ranked by relevance)
        const feedEntries = await this._feedRepository.getFeedEntries({
          userId,
          cursor,
          limit,
          includeRead: false,
        });

        if (feedEntries.length === 0) {
          return { posts: [], nextCursor: null };
        }

        postIds = feedEntries.map((entry) => entry.postId);
        
        const hasMore = feedEntries.length > limit;
        nextCursor = hasMore
          ? feedEntries[feedEntries.length - 1].postId
          : null;

        // Cache the IDs and order
        await RedisCacheService.set(
          cacheKey,
          JSON.stringify({ postIds, nextCursor }),
          this.FEED_CACHE_TTL
        );
      }

      // Get full, fresh post data for these IDs
      const posts = await this._postRepository.getPostsByIds(postIds);

      // Maintain original order from feed entries (ranking)
      const orderedPosts = postIds
        .map((id) => posts.find((p) => p.id === id))
        .filter((p): p is NonNullable<typeof p> => p !== undefined);

      return {
        posts: orderedPosts,
        nextCursor,
      };
    } catch (error: unknown) {
      logger.error("Error getting feed", {
        error: (error as Error).message,
        userId,
      });
      throw new Error("Failed to get feed");
    }
  }

  /**
   * Recalculate relevance scores for a post (when engagement changes)
   */
  async recalculatePostScores(postId: string): Promise<void> {
    try {
      // Get all feed entries for this post
      const feedEntries = await this._feedRepository.getFeedEntriesByPostId(
        postId
      );

      // Get post metadata
      const post = await this._postRepository.findPost(postId);
      if (!post) {
        throw new Error("Post not found");
      }

      const metadata: PostMetadata = {
        authorId: post.userId,
        postId: post.id,
        content: post.content,
        tags: post.tags || [],
        visibility: post.visibility as string,
        likesCount: post.likesCount,
        commentsCount: post.commentsCount,
        sharesCount: post.sharesCount,
        createdAt: post.createdAt,
      };

      // Recalculate scores for all feed entries
      const updates = await Promise.all(
        feedEntries.map(async (entry) => {
          const newScore = await this._feedRankingService.calculateScore(
            postId,
            entry.userId,
            metadata
          );
          return {
            userId: entry.userId,
            postId,
            score: newScore,
          };
        })
      );

      // Batch update scores
      await this._feedRepository.batchUpdateScores(updates);

      // Invalidate cache for affected users (delete pattern-based keys)
      const cacheKeysToDelete = feedEntries.flatMap((entry) => [
        `feed:ids:${entry.userId}:latest`,
        `feed:ids:${entry.userId}:${entry.postId}`,
      ]);
      await Promise.all(cacheKeysToDelete.map((key) => RedisCacheService.delete(key)));

      logger.info("Post scores recalculated", {
        postId,
        affectedUsers: feedEntries.length,
      });
    } catch (error: unknown) {
      logger.error("Error recalculating post scores", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Failed to recalculate post scores");
    }
  }

  /**
   * Remove post from all user feeds (when post is deleted)
   */
  async removeFromAllFeeds(postId: string): Promise<void> {
    try {
      await this._feedRepository.removeFromFeeds(postId);
      logger.info("Post removed from all feeds", { postId });
    } catch (error: unknown) {
      logger.error("Error removing post from feeds", {
        error: (error as Error).message,
        postId,
      });
      throw new Error("Failed to remove post from feeds");
    }
  }
}

