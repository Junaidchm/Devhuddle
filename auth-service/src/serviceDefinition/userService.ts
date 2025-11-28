import {
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
  CheckFollowRequest,
  CheckFollowResponse,
  UserServiceServer,
} from "../grpc/generated/user";
import * as grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util";
import { AuthController } from "../controllers/implimentation/auth.controller";
import { CustomError } from "../utils/error.util";
import { UserRepository } from "../repositories/impliments/user.repository";
import { AuthService } from "../services/impliments/auth.service";
import { FollowsRepository } from "../repositories/impliments/follows.repository";

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
};
