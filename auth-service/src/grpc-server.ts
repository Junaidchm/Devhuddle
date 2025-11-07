import * as grpc from "@grpc/grpc-js";

import {
  AuthServiceService,
  RegisterRequest,
  RegisterResponse,
  AuthServiceServer,
  VerifyOTPRequest,
  VerifyOTPResponse,
  ResentOTPResponse,
  ResentOTPRequest,
  GetJwtUserRequest,
  GetJwtUserResponse,
  LogingRequest,
  LogingResponse,
  PasswordResetRequest,
  PasswordResetResponse,
  PasswordResetConfirmRequest,
  GetProfileRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  VerifyRefreshTokenRequest,
  VerifyRefreshTokenResponse,
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
} from "./grpc/generated/auth";

import { UserServiceService } from "./grpc/generated/user";

import logger from "./utils/logger.util";
import { UserRepository } from "./repositories/impliments/user.repository";
import { AuthService } from "./services/impliments/auth.service";
import { AuthController } from "./controllers/implimentation/auth.controller";
import { CustomError } from "./utils/error.util";
import { userServic } from "./serviceDefinition/userService";

const userRepository: UserRepository = new UserRepository();
const authenticationService: AuthService = new AuthService(userRepository);
const authController: AuthController = new AuthController(
  authenticationService
);

//  Implementing the server interface
const authService: AuthServiceServer = {
  register: async (
    call: grpc.ServerUnaryCall<RegisterRequest, RegisterResponse>,
    callback: grpc.sendUnaryData<RegisterResponse>
  ): Promise<void> => {
    const request = call.request;

    try {
      const response = await authController.register(request);
      callback(null, response);
    } catch (err: any) {
      callback(
        {
          code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
          message: err.message || "Internal server error",
        },
        null
      );
    }
  },
  verifyOtp: async (
    call: grpc.ServerUnaryCall<VerifyOTPRequest, VerifyOTPResponse>,
    callback: grpc.sendUnaryData<VerifyOTPResponse>
  ) => {
    const request = call.request;
    try {
      const response = await authController.verifyOTP(request);
      callback(null, response);
    } catch (err: any) {
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  resendOtp: async (
    call: grpc.ServerUnaryCall<ResentOTPRequest, ResentOTPResponse>,
    callback: grpc.sendUnaryData<ResentOTPResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.resendOTP(request);
      callback(null, response);
    } catch (err: any) {
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  getJwtUser: async (
    call: grpc.ServerUnaryCall<GetJwtUserRequest, GetJwtUserResponse>,
    callback: grpc.sendUnaryData<GetJwtUserResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.getCurrentUser(request);
      callback(null, response);
    } catch (err: any) {
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  login: async (
    call: grpc.ServerUnaryCall<LogingRequest, LogingResponse>,
    callback: grpc.sendUnaryData<LogingResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.login(request);
      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC login error", {
        error: err.message,
        stack: err.stack,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  requestPasswordReset: async (
    call: grpc.ServerUnaryCall<PasswordResetRequest, PasswordResetResponse>,
    callback: grpc.sendUnaryData<PasswordResetResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.requestPasswordReset(request);
      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC requestPasswordReset error", {
        error: err.message,
        stack: err.stack,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  resetPassword: async (
    call: grpc.ServerUnaryCall<
      PasswordResetConfirmRequest,
      PasswordResetResponse
    >,
    callback: grpc.sendUnaryData<PasswordResetResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.resetPassword(request);
      callback(null, response);
    } catch (err: any) {
      logger.error("gRPC requestPasswordReset error", {
        error: err.message,
        stack: err.stack,
      });
      callback({
        code: err instanceof CustomError ? err.status : grpc.status.INTERNAL,
        message: err.message || "Internal server error",
      });
    }
  },
  getProfile: async (
    call: grpc.ServerUnaryCall<GetProfileRequest, GetProfileResponse>,
    callback: grpc.sendUnaryData<GetProfileResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.getProfile(request);
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
  updateProfile: async (
    call: grpc.ServerUnaryCall<UpdateProfileRequest, UpdateProfileResponse>,
    callback: grpc.sendUnaryData<UpdateProfileResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.updateProfile(request);
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
  verifyRefreshToken: async (
    call: grpc.ServerUnaryCall<
      VerifyRefreshTokenRequest,
      VerifyRefreshTokenResponse
    >,
    callback: grpc.sendUnaryData<VerifyRefreshTokenResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.verifyRefreshToken(request);
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
  generatePresignedUrl: async (
    call: grpc.ServerUnaryCall<
      GeneratePresignedUrlRequest,
      GeneratePresignedUrlResponse
    >,
    callback: grpc.sendUnaryData<GeneratePresignedUrlResponse>
  ) => {
    try {
      const request = call.request;
      const response = await authController.generatePresignedUrl(request);
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

const server = new grpc.Server();
server.addService(AuthServiceService, authService);
server.addService(UserServiceService, userServic);

const GRPC_PORT = process.env.GRPC_PORT || "50051";
server.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  () => {
    logger.info(`✅ gRPC server running on port ${GRPC_PORT}`);
  }
);

export default server;
