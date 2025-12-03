"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostController = void 0;
const error_util_1 = require("../../utils/error.util");
const logger_util_1 = __importDefault(require("../../utils/logger.util"));
const http_status_1 = require("../../constands/http.status");
class PostController {
    constructor(postService) {
        this.postService = postService;
    }
    // async feedPosting(req: CreatePostRequest): Promise<CreatePostResponse> {
    //   try {
    //     const post = await this.postService.createPost(req);
    //     return {
    //       message: "Post created",
    //       postId: post.postId,
    //     };
    //   } catch (err: any) {
    //     logger.error("CreatePost error", { error: err.message });
    //     throw new CustomError(HttpStatus.INTERNAL_SERVER_ERROR, err.message);
    //   }
    // }
    async submitPostController(req) {
        try {
            const post = await this.postService.submitPost(req);
            return post;
        }
        catch (err) {
            logger_util_1.default.error("CreatePost error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async getPostsController(req) {
        try {
            const { pageParam, userId } = req;
            const result = await this.postService.getPosts(pageParam, userId);
            return result;
        }
        catch (err) {
            logger_util_1.default.error("List posts error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
    async deletePostController(req) {
        try {
            const { postId } = req;
            const deletePost = await this.postService.deletePostServ(postId);
            return deletePost;
        }
        catch (err) {
            logger_util_1.default.error("delete Post error", { error: err.message });
            throw new error_util_1.CustomError(http_status_1.HttpStatus.INTERNAL_SERVER_ERROR, err.message);
        }
    }
}
exports.PostController = PostController;
