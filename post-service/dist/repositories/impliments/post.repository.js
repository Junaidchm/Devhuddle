"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostRepository = void 0;
const base_repository_1 = require("./base.repository");
const prisma_config_1 = require("../../config/prisma.config");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const redis_config_1 = __importDefault(require("../../config/redis.config"));
const grpc_client_1 = require("../../config/grpc.client");
class PostRepository extends base_repository_1.BaseRepository {
    constructor() {
        super(prisma_config_1.prisma.posts);
    }
    async createPostLogics(data) {
        try {
            const { id: postId } = await super.create(data);
            return { postId };
        }
        catch (error) {
            logger_util_1.default.error("Error creating entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async submitPostRepo(data) {
        try {
            // ✅ FIXED P0-1: Wrap in transaction for atomicity
            // This ensures post and media attachments are created atomically
            // If any part fails, entire operation rolls back (no orphaned media)
            const post = await prisma_config_1.prisma.$transaction(async (tx) => {
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
                        throw new Error("One or more media files are already attached to another post");
                    }
                }
                // Create post with attachments atomically
                const newPost = await tx.posts.create({
                    data: {
                        content: data.content,
                        userId: data.userId,
                        visibility: data.visibility, // Will be properly typed after proto update
                        commentControl: data.commentControl, // Will be properly typed after proto update
                        attachments: data.mediaIds && data.mediaIds.length > 0
                            ? {
                                connect: data.mediaIds.map((id) => ({ id })),
                            }
                            : undefined,
                    },
                    include: {
                        attachments: true,
                    },
                });
                return newPost;
            }, {
                timeout: 10000, // 10 second timeout
                maxWait: 5000, // Maximum wait time for transaction
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error creating post", {
                error: error.message,
                stack: error.stack,
                userId: data.userId,
                mediaIds: data.mediaIds,
            });
            throw new Error(error.message || "Database error");
        }
    }
    async findPost(postId) {
        try {
            const post = await prisma_config_1.prisma.posts.findUnique({
                where: {
                    id: postId,
                },
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error find entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async deletePost(postId) {
        try {
            const post = await prisma_config_1.prisma.posts.delete({
                where: {
                    id: postId,
                },
            });
            return post;
        }
        catch (error) {
            logger_util_1.default.error("Error delete entity", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async getPostsRepo(postSelectOptions) {
        try {
            const posts = await prisma_config_1.prisma.posts.findMany(postSelectOptions);
            // console.log('this is the fetched data .......', posts)
            const enrichedPosts = await Promise.all(posts.map((post) => new Promise((resolve, reject) => {
                grpc_client_1.userClient.getUserForFeedListing({ userId: post.userId }, (err, response) => {
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
                });
            })));
            return enrichedPosts;
        }
        catch (err) {
            logger_util_1.default.error("Error fetching the posts ", {
                error: err.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementLikesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    likesCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing likes count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async decrementLikesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    likesCount: {
                        decrement: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing likes count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementCommentsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    commentsCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing comments count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async decrementCommentsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    commentsCount: {
                        decrement: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error decrementing comments count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementSharesCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    sharesCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing shares count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async incrementReportsCount(postId) {
        try {
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: {
                    reportsCount: {
                        increment: 1,
                    },
                },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error incrementing reports count", {
                error: error.message,
            });
            throw new Error("Database error");
        }
    }
    async updatePost(postId, data) {
        try {
            return await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data,
            });
        }
        catch (error) {
            logger_util_1.default.error("Error updating post", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
    async lockForEditing(postId) {
        try {
            // Use Redis for distributed locking
            const lockKey = `post:edit:lock:${postId}`;
            // Try to set with NX (only if not exists) and EX (expiration)
            // Redis v5+ uses SET with options
            const result = await redis_config_1.default.set(lockKey, "1", {
                EX: 300, // 5 minute expiration
                NX: true, // Only set if not exists
            });
            // Redis SET with NX returns "OK" if set, null if key exists
            if (result !== "OK") {
                throw new Error("Post is currently being edited");
            }
            // Also update DB flag
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: { isEditing: true },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error locking post for editing", {
                error: error.message,
                postId,
            });
            throw error;
        }
    }
    async unlockEditing(postId) {
        try {
            const lockKey = `post:edit:lock:${postId}`;
            await redis_config_1.default.del(lockKey);
            await prisma_config_1.prisma.posts.update({
                where: { id: postId },
                data: { isEditing: false },
            });
        }
        catch (error) {
            logger_util_1.default.error("Error unlocking post for editing", {
                error: error.message,
                postId,
            });
            throw new Error("Database error");
        }
    }
}
exports.PostRepository = PostRepository;
