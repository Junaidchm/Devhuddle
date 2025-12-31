"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostSerive = void 0;
const error_util_1 = require("../../utils/error.util");
// import { PostMapper } from "../../mapper/post.mapper";
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const grpc = __importStar(require("@grpc/grpc-js"));
const redis_util_1 = require("../../utils/redis.util");
const prisma_config_1 = require("../../config/prisma.config");
const client_1 = require("@prisma/client");
const kafka_config_1 = require("../../config/kafka.config");
const grpc_client_1 = require("../../config/grpc.client");
const grpc_client_call_util_1 = require("../../utils/grpc.client.call.util");
class PostSerive {
    constructor(postRepository, likeRepository, commentRepository, shareRepository, postVersionRepository, feedService, //  NEW: Feed service for fan-out
    outboxService //  NEW: Outbox service for events
    ) {
        this.postRepository = postRepository;
        this.likeRepository = likeRepository;
        this.commentRepository = commentRepository;
        this.shareRepository = shareRepository;
        this.postVersionRepository = postVersionRepository;
        this.feedService = feedService;
        this.outboxService = outboxService;
    }
    async submitPost(req) {
        try {
            // 1. Create post in database (transaction ensures atomicity)
            const post = await this.postRepository.submitPostRepo(req);
            // 2.  NEW: Fan-out to followers (production-ready feed generation)
            if (this.feedService) {
                try {
                    // Get followers from User Service
                    let followers = [];
                    try {
                        const followersResponse = await (0, grpc_client_call_util_1.grpcs)(grpc_client_1.userClient, "getFollowers", { userId: req.userId });
                        followers = (followersResponse.followers || []).map((f) => ({
                            id: f.id,
                            username: f.username,
                            name: f.name,
                        }));
                    }
                    catch (followersError) {
                        // If GetFollowers not implemented yet, log and continue
                        logger_util_1.default.warn("GetFollowers not available, skipping fan-out", {
                            error: followersError.message,
                            userId: req.userId,
                        });
                        // For now, we'll still create the outbox event
                        // Fan-out can be done manually or when GetFollowers is implemented
                    }
                    // Only fan-out if we have followers and feed service is available
                    if (followers.length > 0 && this.feedService) {
                        // Extract post metadata
                        const postData = await this.postRepository.findPost(post.id);
                        if (postData) {
                            const metadata = {
                                authorId: postData.userId,
                                postId: postData.id,
                                content: postData.content,
                                tags: postData.tags || [],
                                visibility: postData.visibility,
                                likesCount: postData.likesCount,
                                commentsCount: postData.commentsCount,
                                sharesCount: postData.sharesCount,
                                createdAt: postData.createdAt,
                            };
                            // Fan-out strategy: synchronous for < 1000 followers
                            if (followers.length < 1000) {
                                await this.feedService.fanOutToFollowers({
                                    postId: post.id,
                                    authorId: req.userId,
                                    followers,
                                    metadata,
                                });
                            }
                            else {
                                // For > 1000 followers, queue for async processing
                                // TODO: Implement async queue worker
                                logger_util_1.default.info("Large follower count, async fan-out recommended", {
                                    postId: post.id,
                                    followerCount: followers.length,
                                });
                                // For now, process in batches
                                await this.feedService.fanOutToFollowers({
                                    postId: post.id,
                                    authorId: req.userId,
                                    followers: followers.slice(0, 1000), // Process first 1000
                                    metadata,
                                });
                            }
                        }
                    }
                }
                catch (fanOutError) {
                    // Log error but don't fail post creation
                    logger_util_1.default.error("Fan-out error (non-fatal)", {
                        error: fanOutError.message,
                        postId: post.id,
                    });
                }
            }
            // 3.  NEW: Publish event for notifications
            if (this.outboxService) {
                try {
                    await this.outboxService.createOutboxEvent({
                        aggregateType: client_1.OutboxAggregateType.POST,
                        aggregateId: post.id,
                        type: client_1.OutboxEventType.POST_CREATED,
                        topic: kafka_config_1.KAFKA_TOPICS.POST_CREATED,
                        key: req.userId, // Use userId as partition key
                        payload: {
                            postId: post.id,
                            userId: req.userId,
                            visibility: req.visibility || "PUBLIC",
                            content: req.content.substring(0, 200), // Preview
                            createdAt: new Date().toISOString(),
                            version: Date.now(),
                            action: "POST_CREATED",
                        },
                    });
                }
                catch (eventError) {
                    // Log but don't fail post creation
                    logger_util_1.default.error("Outbox event creation error (non-fatal)", {
                        error: eventError.message,
                        postId: post.id,
                    });
                }
            }
            return post;
        }
        catch (err) {
            logger_util_1.default.error("CreatePost error", { error: err.message });
            throw new error_util_1.CustomError(grpc.status.INTERNAL, err.message);
        }
    }
    async getPosts(pageParam, userId) {
        try {
            //  NEW: Use personalized feed if feedService is available and userId provided
            if (this.feedService && userId) {
                try {
                    const feedResponse = await this.feedService.getFeed(userId, pageParam, 10);
                    //  FIX: If feed is empty, fall back to legacy query (for cases where UserFeed hasn't been populated yet)
                    if (feedResponse.posts.length === 0) {
                        logger_util_1.default.info("Feed service returned empty, falling back to legacy query", {
                            userId,
                            pageParam,
                        });
                        // Fall through to legacy implementation below
                    }
                    else {
                        const postIds = feedResponse.posts.map((p) => p.id);
                        // Enrich with engagement data
                        let userLikesMap = {};
                        let userSharesMap = {};
                        if (postIds.length > 0) {
                            userLikesMap =
                                (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
                                    {};
                            userSharesMap =
                                (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
                                    {};
                        }
                        const enrichedPosts = feedResponse.posts.map((post) => {
                            //  FIX: Transform Media array to Attachments format
                            const attachments = (post.Media || []).map((media) => ({
                                id: media.id,
                                post_id: media.postId || post.id,
                                type: String(media.type || "IMAGE"), // Convert enum to string (IMAGE or VIDEO)
                                url: media.url,
                                created_at: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
                            }));
                            return {
                                ...post,
                                attachments, //  Add attachments array
                                engagement: {
                                    likesCount: post.likesCount ?? 0,
                                    commentsCount: post.commentsCount ?? 0,
                                    sharesCount: post.sharesCount ?? 0,
                                    isLiked: userLikesMap[post.id] ?? false,
                                    isShared: userSharesMap[post.id] ?? false,
                                },
                            };
                        });
                        return {
                            pages: enrichedPosts,
                            nextCursor: feedResponse.nextCursor ?? undefined,
                        };
                    }
                }
                catch (feedError) {
                    // If feed service fails, fall back to naive approach
                    logger_util_1.default.warn("Feed service error, falling back to naive query", {
                        error: feedError.message,
                        userId,
                    });
                    // Fall through to legacy implementation
                }
            }
            //  FALLBACK: Legacy naive query (for backwards compatibility or if feedService unavailable)
            //  FIX: Order by createdAt DESC to ensure newest posts appear first (UUIDs don't sort chronologically)
            const PAGE_SIZE = 10;
            //  FIX: Use offset-based pagination with createdAt ordering
            // If pageParam (post ID) is provided, find how many posts to skip based on createdAt
            let skipCount = 0;
            if (pageParam) {
                const cursorPost = await this.postRepository.findPost(pageParam);
                if (cursorPost && cursorPost.createdAt) {
                    // Count posts created after this one (newer posts) to determine skip count
                    const newerPostsCount = await prisma_config_1.prisma.posts.count({
                        where: {
                            createdAt: {
                                gt: cursorPost.createdAt,
                            },
                        },
                    });
                    skipCount = newerPostsCount;
                }
            }
            const PostselectOptions = {
                include: {
                    Media: true, //  FIX: Changed from 'attachments' to 'Media' to match schema
                },
                take: PAGE_SIZE + 1,
                skip: skipCount,
                orderBy: { createdAt: "desc" }, //  CRITICAL FIX: Order by createdAt DESC for chronological ordering (UUIDs are not chronological!)
            };
            const prismaPosts = await this.postRepository.getPostsRepo(PostselectOptions);
            const hasMore = prismaPosts.length > PAGE_SIZE;
            const items = prismaPosts.slice(0, PAGE_SIZE);
            const postIds = items.map((post) => post.id);
            let userLikesMap = {};
            let userSharesMap = {};
            if (userId && postIds.length > 0) {
                userLikesMap =
                    (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
                        {};
                userSharesMap =
                    (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
                        {};
            }
            const enrichedPosts = items.map((post) => {
                //  FIX: Transform Media array to Attachments format
                const attachments = (post.Media || []).map((media) => ({
                    id: media.id,
                    post_id: media.postId || post.id,
                    type: String(media.type || "IMAGE"), // Convert enum to string (IMAGE or VIDEO)
                    url: media.url,
                    created_at: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
                }));
                return {
                    ...post,
                    attachments, //  Add attachments array
                    engagement: {
                        likesCount: post.likesCount ?? 0,
                        commentsCount: post.commentsCount ?? 0,
                        sharesCount: post.sharesCount ?? 0,
                        isLiked: userLikesMap[post.id] ?? false,
                        isShared: userSharesMap[post.id] ?? false,
                    },
                };
            });
            //  FIX: Use post ID as cursor (for next page pagination)
            const nextCursor = hasMore ? enrichedPosts[enrichedPosts.length - 1].id : null;
            return {
                pages: enrichedPosts,
                nextCursor,
            };
        }
        catch (err) {
            throw new error_util_1.CustomError(grpc.status.INTERNAL, err.message);
        }
    }
    async deletePostServ(postId) {
        try {
            const isthere = await this.postRepository.findPost(postId);
            if (!isthere) {
                throw new error_util_1.CustomError(grpc.status.NOT_FOUND, "Post Not found");
            }
            const deletedPost = await this.postRepository.deletePost(postId);
            //  NEW: Remove post from all user feeds
            if (this.feedService) {
                try {
                    await this.feedService.removeFromAllFeeds(postId);
                }
                catch (feedError) {
                    // Log but don't fail deletion
                    logger_util_1.default.error("Error removing post from feeds (non-fatal)", {
                        error: feedError.message,
                        postId,
                    });
                }
            }
            return deletedPost;
        }
        catch (err) {
            logger_util_1.default.error("delete Post error", { error: err.message });
            throw new error_util_1.CustomError(grpc.status.INTERNAL, err.message);
        }
    }
    async editPost(req) {
        try {
            // 1. Get post
            const post = await this.postRepository.findPost(req.postId);
            if (!post) {
                throw new error_util_1.CustomError(grpc.status.NOT_FOUND, "Post not found");
            }
            // 2. Authorization: Only owner can edit
            if (post.userId !== req.userId) {
                throw new error_util_1.CustomError(grpc.status.PERMISSION_DENIED, "Unauthorized: Only post owner can edit");
            }
            // 3. Check if post is locked (attachments processing)
            if (post.isEditing) {
                throw new error_util_1.CustomError(grpc.status.FAILED_PRECONDITION, "Post is currently being edited. Please wait.");
            }
            // 4. Lock post for editing
            await this.postRepository.lockForEditing(req.postId);
            try {
                // 5. Validate attachments if adding
                if (req.addAttachmentIds && req.addAttachmentIds.length > 0) {
                    const existingMedia = await prisma_config_1.prisma.media.findMany({
                        where: { id: { in: req.addAttachmentIds } },
                    });
                    if (existingMedia.length !== req.addAttachmentIds.length) {
                        throw new error_util_1.CustomError(grpc.status.NOT_FOUND, "One or more media files not found");
                    }
                }
                // 6. Create new version (transaction)
                const result = await prisma_config_1.prisma.$transaction(async (tx) => {
                    // Get current attachments
                    const currentAttachments = await tx.media.findMany({
                        where: { postId: req.postId },
                    });
                    // Calculate new attachment set
                    const attachmentIdsToKeep = currentAttachments
                        .map((a) => a.id)
                        .filter((id) => !req.removeAttachmentIds?.includes(id));
                    const newAttachmentIds = [
                        ...attachmentIdsToKeep,
                        ...(req.addAttachmentIds || []),
                    ];
                    const newVersionNumber = post.currentVersion + 1;
                    const newContent = req.content ?? post.content;
                    // Create version
                    if (this.postVersionRepository) {
                        await this.postVersionRepository.createVersion({
                            postId: req.postId,
                            versionNumber: newVersionNumber,
                            content: newContent,
                            attachmentIds: newAttachmentIds,
                            editedById: req.userId,
                        });
                    }
                    // Update post
                    const updatedPost = await tx.posts.update({
                        where: { id: req.postId },
                        data: {
                            content: newContent,
                            currentVersion: newVersionNumber,
                            lastEditedAt: new Date(),
                            editCount: { increment: 1 },
                            isEditing: false, // Unlock
                        },
                        include: {
                            Media: true,
                        },
                    });
                    // Update attachments
                    if (req.removeAttachmentIds && req.removeAttachmentIds.length > 0) {
                        await tx.media.deleteMany({
                            where: {
                                id: { in: req.removeAttachmentIds },
                                postId: req.postId,
                            },
                        });
                    }
                    if (req.addAttachmentIds && req.addAttachmentIds.length > 0) {
                        await tx.media.updateMany({
                            where: { id: { in: req.addAttachmentIds } },
                            data: { postId: req.postId },
                        });
                    }
                    return { post: updatedPost, versionNumber: newVersionNumber };
                });
                // 7. Invalidate caches
                await redis_util_1.RedisCacheService.invalidatePostCaches(req.postId);
                return {
                    success: true,
                    post: result.post,
                    newVersionNumber: result.versionNumber,
                };
            }
            catch (error) {
                // Unlock on error
                await this.postRepository.unlockEditing(req.postId);
                throw error;
            }
        }
        catch (err) {
            logger_util_1.default.error("Error editing post", {
                error: err.message,
                postId: req.postId,
                userId: req.userId,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(grpc.status.INTERNAL, "Failed to edit post");
        }
    }
    async getPostVersions(req) {
        try {
            // Verify ownership
            const post = await this.postRepository.findPost(req.postId);
            if (!post || post.userId !== req.userId) {
                throw new error_util_1.CustomError(grpc.status.PERMISSION_DENIED, "Unauthorized");
            }
            if (!this.postVersionRepository) {
                throw new error_util_1.CustomError(grpc.status.INTERNAL, "Post version repository not available");
            }
            const versions = await this.postVersionRepository.getByPostId(req.postId);
            return {
                versions: versions.map((v) => ({
                    id: v.id,
                    postId: v.postId,
                    versionNumber: v.versionNumber,
                    content: v.content,
                    attachmentIds: v.attachmentIds,
                    editedAt: v.editedAt.toISOString(),
                    editedById: v.editedById,
                })),
            };
        }
        catch (err) {
            logger_util_1.default.error("Error getting post versions", {
                error: err.message,
                postId: req.postId,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(grpc.status.INTERNAL, "Failed to get post versions");
        }
    }
    async restorePostVersion(req) {
        try {
            if (!this.postVersionRepository) {
                throw new error_util_1.CustomError(grpc.status.INTERNAL, "Post version repository not available");
            }
            // Get version
            const version = await this.postVersionRepository.getByPostAndVersion(req.postId, req.versionNumber);
            if (!version) {
                throw new error_util_1.CustomError(grpc.status.NOT_FOUND, "Version not found");
            }
            // Verify ownership
            const post = await this.postRepository.findPost(req.postId);
            if (!post || post.userId !== req.userId) {
                throw new error_util_1.CustomError(grpc.status.PERMISSION_DENIED, "Unauthorized");
            }
            // Restore (create new version with old content)
            const editResult = await this.editPost({
                postId: req.postId,
                userId: req.userId,
                content: version.content,
                addAttachmentIds: version.attachmentIds,
                removeAttachmentIds: [],
                idempotencyKey: `restore-${req.postId}-${req.versionNumber}`,
            });
            return {
                success: true,
                post: editResult.post,
            };
        }
        catch (err) {
            logger_util_1.default.error("Error restoring post version", {
                error: err.message,
                postId: req.postId,
                versionNumber: req.versionNumber,
            });
            throw err instanceof error_util_1.CustomError
                ? err
                : new error_util_1.CustomError(grpc.status.INTERNAL, "Failed to restore post version");
        }
    }
}
exports.PostSerive = PostSerive;
