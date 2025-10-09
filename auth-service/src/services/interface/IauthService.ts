import { Request, Response } from "express";
import { 
  LoginRequest, 
  OAuthUser, 
  PasswordResetConfirmRequest, 
  PasswordResetRequest, 
  ProfileUpdatePayload, 
  RegisterRequest, 
  User, 
  VerifyOTPRequest, 
  jwtUserFilter 
} from "../../types/auth";
import {  GetJwtUserResponse, GetProfileResponse, JwtPayload, LogingRequest, UpdateProfileResponse } from "../../grpc/generated/auth";
import { getUserForFeedListingResponse } from "../../grpc/generated/user";

export interface IAuthService {
  register(registerData: RegisterRequest): Promise<void>;
  verifyOTP(verifyOTPData: VerifyOTPRequest): Promise<JwtPayload>;
  resendOTP(email: string): Promise<void>;
  getJwtPayload(id: string): Promise<GetJwtUserResponse>;
  getUserProfile(id:string):Promise<GetProfileResponse>;
  login(loginData: LogingRequest): Promise<GetJwtUserResponse>;
  requestPasswordReset(resetRequest: PasswordResetRequest): Promise<void>;
  resetPassword(resetData: PasswordResetConfirmRequest): Promise<void>;
  handleOAuthLogin(oauthUser: OAuthUser, res: Response): Promise<GetJwtUserResponse>;
  verifyUser(email: string): Promise<JwtPayload>;
  updateProfile(userId: string, data: ProfileUpdatePayload): Promise<UpdateProfileResponse>;
  getUserForFeedPostServic(userId:string):Promise<getUserForFeedListingResponse>
  generatePresignedUrl(
    userId: string,
    operation: string,
    fileName?: string,
    fileType?: string,
    key?: string
  ): Promise<{
    url: string;
    key?: string;
    presignedKey?: string;
    expiresAt: number;
  }>;
}