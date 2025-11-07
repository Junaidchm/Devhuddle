import {
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
  UserServiceServer,
} from "../grpc/generated/user";
import * as grpc from "@grpc/grpc-js";
import logger from "../utils/logger.util";
import { AuthController } from "../controllers/implimentation/auth.controller";
import { CustomError } from "../utils/error.util";
import { UserRepository } from "../repositories/impliments/user.repository";
import { AuthService } from "../services/impliments/auth.service";

const userRepository: UserRepository = new UserRepository();
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
};
