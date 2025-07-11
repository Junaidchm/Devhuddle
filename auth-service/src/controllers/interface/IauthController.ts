import { NextFunction, Request, Response } from "express";
import { jwtPayload, jwtUserFilter, LoginRequest, OAuthUser, PasswordResetConfirmRequest, PasswordResetRequest, RegisterRequest, VerifyOTPRequest } from "../../types/auth";
import * as authProto from "../../../grpc-generated/auth_pb";

export interface IAuthController {
  register(call: authProto.RegisterRequest): Promise<authProto.RegisterResponse>;
  verifyOTP(req: Request, res: Response): Promise<void>;
  login(req: Request, res: Response): Promise<void>;
  resendOTP(req: Request, res: Response): Promise<void>;
  getCurrentUser(req: Request, res: Response): Promise<void>;
  requestPasswordReset(req: Request, res: Response): Promise<void>;
  resetPassword(req: Request, res: Response): Promise<void>;
  updateProfile(req: Request, res: Response, next: NextFunction): Promise<void>;
  verifyRefreshToken(req: Request, res: Response): Promise<void>;
  logoutUser(req: Request, res: Response): Promise<void>;
  getProfile(req: Request, res: Response): Promise<void>;
  generatePresignedUrl(req: Request, res: Response, next: NextFunction): Promise<void>;
  googleAuth(req: Request, res: Response, next: NextFunction): void;
  googleCallback(req: Request, res: Response, next: NextFunction): void;
}