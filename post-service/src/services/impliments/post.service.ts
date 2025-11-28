import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  CreatePostRequest,
  CreatePostResponse,
  DeletePostResponse,
  ListPostsResponse,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import {
  IPostRepository,
  PostSelectOptions,
} from "../../repositories/interface/IPostRepository";
import { IpostService } from "../interfaces/IpostService";
import { CustomError } from "../../utils/error.util";
// import { PostMapper } from "../../mapper/post.mapper";
import logger from "../../utils/logger.util";
import * as grpc from "@grpc/grpc-js";
import { ILikeRepository } from "../../repositories/interface/ILikeRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { IShareRepository } from "../../repositories/interface/IShareRepository";

export class PostSerive implements IpostService {
  constructor(
    private postRepository: IPostRepository,
    private likeRepository?: ILikeRepository,
    private commentRepository?: ICommentRepository,
    private shareRepository?: IShareRepository
  ) {}

  // async createPost(payload: CreatePostRequest) {
  //   try {
  //     const newPost = PostMapper.toPost(payload);
  //     const { postId } = await this.postRepository.createPostLogics(newPost);
  //     return { postId };
  //   } catch (err: any) {
  //     logger.error("CreatePost error", { error: err.message });
  //     throw new CustomError(grpc.status.INTERNAL, err.message);
  //   }
  // }

  async submitPost(req: SubmitPostRequest): Promise<SubmitPostResponse> {
    try {
      const post: SubmitPostResponse = await this.postRepository.submitPostRepo(
        req
      );
      return post;
    } catch (err: any) {
      logger.error("CreatePost error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async getPosts(pageParam?: string, userId?: string): Promise<ListPostsResponse> {
    try {
      const PAGE_SIZE = 10;
      const PostselectOptions: PostSelectOptions = {
        include: {
          attachments: true,
        },
        take: PAGE_SIZE + 1,
        skip: pageParam ? 1 : 0,
        cursor: pageParam ? { id: pageParam } : undefined,
        orderBy: { id: "desc" },
      };

      const prismaPosts: any = await this.postRepository.getPostsRepo(
        PostselectOptions
      );

      const hasMore = prismaPosts.length > PAGE_SIZE;
      const items = prismaPosts.slice(0, PAGE_SIZE);
      const postIds = items.map((post: any) => post.id);

      let userLikesMap: Record<string, boolean> = {};
      let userSharesMap: Record<string, boolean> = {};

      if (userId && postIds.length > 0) {
        userLikesMap =
          (await this.likeRepository?.getUserLikesForPosts(userId, postIds)) ||
          {};
        userSharesMap =
          (await this.shareRepository?.getUserSharesForPosts(userId, postIds)) ||
          {};
      }

      const enrichedPosts = items.map((post: any) => ({
        ...post,
        engagement: {
          likesCount: post.likesCount ?? 0,
          commentsCount: post.commentsCount ?? 0,
          sharesCount: post.sharesCount ?? 0,
          isLiked: userLikesMap[post.id] ?? false,
          isShared: userSharesMap[post.id] ?? false,
        },
      }));

      const nextCursor = hasMore ? enrichedPosts[enrichedPosts.length - 1].id : null;

      return {
        pages: enrichedPosts,
        nextCursor,
      };
    } catch (err: any) {
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }

  async deletePostServ(postId: string): Promise<DeletePostResponse> {
    try {
      const isthere = await this.postRepository.findPost(postId);

      if (!isthere) {
        throw new CustomError(grpc.status.NOT_FOUND, "Post Not found");
      }

      const deletedPost = await this.postRepository.deletePost(postId);

      return deletedPost;
    } catch (err: any) {
      logger.error("delete Post error", { error: err.message });
      throw new CustomError(grpc.status.INTERNAL, err.message);
    }
  }
}
