import {
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
  CheckFollowRequest,
  CheckFollowResponse,
  GetFollowersRequest,
  GetFollowersResponse,
  GetUserProfilesRequest,
  GetUserProfilesResponse,
  UserServiceServer,
} from "../grpc/generated/user";
import * as grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util";
import { AuthController } from "../controllers/implimentation/auth.controller";
import { CustomError } from "../utils/error.util";
import { UserRepository } from "../repositories/impliments/user.repository";
import { AuthService } from "../services/impliments/auth.service";
import { FollowsRepository } from "../repositories/impliments/follows.repository";
import prisma from "../config/prisma.config";

const userRepository: UserRepository = new UserRepository();
const followsRepository: FollowsRepository = new FollowsRepository();
const authenticationService: AuthService = new AuthService(userRepository);
const authController: AuthController = new AuthController(
  authenticationService
);

export const userServic: UserServiceServer = {
  getUserForFeedListing: async (
    call: grpc.ServerUnaryCall<
      getUserForFeedListingRequest,
      getUserForFeedListingResponse
    >,
    callback: grpc.sendUnaryData<getUserForFeedListingResponse>
  ) => {
    try {
      const request = call.request;

      const response = await authController.getUserForFeedPost(request);

      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC getProfile error", {
        error: err.message,
        stack: err.stack,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  checkFollow: async (
    call: grpc.ServerUnaryCall<CheckFollowRequest, CheckFollowResponse>,
    callback: grpc.sendUnaryData<CheckFollowResponse>
  ) => {
    try {
      const request = call.request;
      const { followerId, followingId } = request;

      const isFollowing = await followsRepository.checkFollowExists(
        followerId,
        followingId
      );

      const response: CheckFollowResponse = {
        isFollowing,
      };

      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC checkFollow error", {
        error: err.message,
        stack: err.stack,
        followerId: call.request.followerId,
        followingId: call.request.followingId,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  getFollowers: async (
    call: grpc.ServerUnaryCall<GetFollowersRequest, GetFollowersResponse>,
    callback: grpc.sendUnaryData<GetFollowersResponse>
  ) => {
    try {
      const request = call.request;
      const { userId } = request;

      logger.info("gRPC getFollowers called", { userId });

      // Get follower IDs
      const followerIds = await followsRepository.getFollowerIds(userId);

      // If no followers, return empty array
      if (followerIds.length === 0) {
        logger.info("No followers found", { userId });
        callback(null, { followers: [] });
        return;
      }

      // Fetch follower details using prisma directly
      const followerUsers = await prisma.user.findMany({
        where: {
          id: { in: followerIds },
          isBlocked: false,
        },
        select: {
          id: true,
          username: true,
          name: true,
        },
      });

      const followers = followerUsers.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name,
      }));

      logger.info("Followers fetched successfully", {
        userId,
        followerCount: followers.length,
      });

      callback(null, { followers });
    } catch (err: any) {
      logger.error("gRPC getFollowers error", {
        error: err.message,
        stack: err.stack,
        userId: call.request.userId,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  getUserProfiles: async (
    call: grpc.ServerUnaryCall<GetUserProfilesRequest, GetUserProfilesResponse>,
    callback: grpc.sendUnaryData<GetUserProfilesResponse>
  ) => {
    try {
      const request = call.request;
      const { userIds } = request;

      logger.info("gRPC getUserProfiles called", { userCount: userIds?.length || 0 });

      // If no user IDs provided, return empty array
      if (!userIds || userIds.length === 0) {
        logger.info("No user IDs provided");
        callback(null, { profiles: [] });
        return;
      }

      // Fetch user profiles using prisma directly
      const users = await prisma.user.findMany({
        where: {
          id: { in: userIds },
          isBlocked: false,
        },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
        },
      });

      const profiles = users.map((user) => ({
        id: user.id,
        username: user.username,
        name: user.name || user.username,
        profilePhoto: user.profilePicture || "",
      }));

      logger.info("User profiles fetched successfully", {
        requested: userIds.length,
        found: profiles.length,
      });

      callback(null, { profiles });
    } catch (err: any) {
      logger.error("gRPC getUserProfiles error", {
        error: err.message,
        stack: err.stack,
        userCount: call.request.userIds?.length || 0,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
};

