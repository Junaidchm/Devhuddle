import { NextFunction, Request, Response } from "express";
import {
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
  GetJwtUserRequest,
  GetJwtUserResponse,
  GetProfileRequest,
  GetProfileResponse,
  LogingRequest,
  LogingResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  RegisterRequest,
  RegisterResponse,
  ResentOTPRequest,
  ResentOTPResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  VerifyRefreshTokenRequest,
  VerifyRefreshTokenResponse,
} from "../../grpc/generated/auth";
import { getUserForFeedListingRequest, getUserForFeedListingResponse } from "../../grpc/generated/user";

export interface IAuthController {
  register(req: RegisterRequest): Promise<RegisterResponse>;
  verifyOTP(req: VerifyOTPRequest): Promise<VerifyOTPResponse>;
  login(req: LogingRequest): Promise<LogingResponse>;
  resendOTP(req: ResentOTPRequest): Promise<ResentOTPResponse>;
  getCurrentUser(req: GetJwtUserRequest): Promise<GetJwtUserResponse>;
  requestPasswordReset(req:PasswordResetRequest): Promise<PasswordResetResponse>;
  resetPassword(req:PasswordResetConfirmRequest): Promise<PasswordResetResponse>;
  updateProfile(req:UpdateProfileRequest): Promise<UpdateProfileResponse>;
  verifyRefreshToken(req:VerifyRefreshTokenRequest): Promise<VerifyRefreshTokenResponse>;
  getProfile(req:GetProfileRequest): Promise<GetProfileResponse>;
  generatePresignedUrl(req:GeneratePresignedUrlRequest): Promise<GeneratePresignedUrlResponse>;
  googleAuth(req: Request, res: Response, next: NextFunction): void;
  googleCallback(req: Request, res: Response, next: NextFunction): void;
  getUserForFeedPost(req:getUserForFeedListingRequest):Promise<getUserForFeedListingResponse>
}
