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

export interface IAuthService {
  register(registerData: RegisterRequest): Promise<void>;
  verifyOTP(verifyOTPData: VerifyOTPRequest): Promise<jwtUserFilter>;
  resendOTP(email: string): Promise<void>;
  getUserById(id: string): Promise<User>;
  login(loginData: LoginRequest): Promise<jwtUserFilter>;
  requestPasswordReset(resetRequest: PasswordResetRequest): Promise<void>;
  resetPassword(resetData: PasswordResetConfirmRequest): Promise<void>;
  handleOAuthLogin(oauthUser: OAuthUser, res: Response): Promise<jwtUserFilter>;
  verifyUser(email: string): Promise<jwtUserFilter>;
  updateProfile(userId: string, data: ProfileUpdatePayload): Promise<User>;
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