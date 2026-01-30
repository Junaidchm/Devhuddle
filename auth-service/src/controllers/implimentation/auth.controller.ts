import { NextFunction, Request, Response } from "express";

import {
  jwtPayload,
  jwtUserFilter,
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  ProfileUpdatePayload,
  TokenResponse,
} from "../../types/auth";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import passport from "../../config/passport.config";
import { setAuthToken, clearCookies, setAccesToken } from "../../utils/jwtHandler";
import { Messages } from "../../constents/reqresMessages";
import { setJtiAsBlackListed } from "../../utils/redis.actions";
import { generateUuid4 } from "../../utils/uuid.util";
import { verifyRefreshToken } from "../../utils/jwt.util";
import { IAuthService } from "../../services/interface/IauthService";
import { IAuthController } from "../interface/IauthController";
import {
  RegisterResponse,
  RegisterRequest,
  VerifyOTPResponse,
  VerifyOTPRequest,
  JwtPayload,
  ResentOTPRequest,
  ResentOTPResponse,
  GetJwtUserRequest,
  GetJwtUserResponse,
  LogingRequest,
  LogingResponse,
  PasswordResetResponse,
  GetProfileRequest,
  GetProfileResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  VerifyRefreshTokenRequest,
  VerifyRefreshTokenResponse,
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
} from "../../grpc/generated/auth";
import * as grpc from "@grpc/grpc-js";
import {
  getUserForFeedListingRequest,
  getUserForFeedListingResponse,
} from "../../grpc/generated/user";
import { HttpStatus } from "../../constents/httpStatus";
import { User } from "@prisma/client";

export class AuthController implements IAuthController {
  constructor(private _authService: IAuthService) {}


  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;

      if (!query || query.trim().length < 2) {
        res.status(HttpStatus.OK).json([]);
        return;
      }

      const users: Partial<User>[] = await this._authService.searchUsers(
        query,
        currentUserId
      );
      res.status(HttpStatus.OK).json(users);
    } catch (err: unknown) {
      logger.error("Search users error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  async register(req: RegisterRequest): Promise<RegisterResponse> {
    // Validation is now handled by validateDto middleware
    const { name, username, email, password } = req;
    await this._authService.register({ email, username, name, password });

    return { message: Messages.VERIFY_EMAIL_WITH_OTP };
  }

  async verifyOTP(req: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    // Validation handled by DTO

    const { email, otp } = req;
    const jwtpayload: JwtPayload = await this._authService.verifyOTP(req);
    return {
      message: Messages.EMAIL_VERIFIED,
      jwtpayload,
    };
  }

  async login(req: LogingRequest): Promise<LogingResponse> {
    const { email, password } = req;
    // Validation handled by DTO
    const jwtpayload: GetJwtUserResponse = await this._authService.login({
      email,
      password,
    });

    return {
      message: Messages.LOGIN_SUCCESS,
      jwtpayload,
    };
  }

  async resendOTP(req: ResentOTPRequest): Promise<ResentOTPResponse> {
    const { email } = req;
    // Validation handled by DTO
    await this._authService.resendOTP(email);
    return { message: Messages.OTP_RESENT };
  }

  async getCurrentUser(req: GetJwtUserRequest): Promise<GetJwtUserResponse> {
    const user = await this._authService.getJwtPayload(req.userId);
    return user;
  }

  async requestPasswordReset(
    req: PasswordResetRequest
  ): Promise<PasswordResetResponse> {
    const { email } = req;
    // Validation handled by DTO
    await this._authService.requestPasswordReset({ email });
    return { message: Messages.PASSWORD_SENDTO_MAIL };
  }

  async resetPassword(req: PasswordResetConfirmRequest) {
    // Validation handled by DTO

    const { token, newPassword } = req;
    await this._authService.resetPassword({ token, newPassword });
    return { message: Messages.PASSWORD_UPDATED };
  }

  async updateProfile(
    req: UpdateProfileRequest
  ): Promise<UpdateProfileResponse> {
    const { 
      userId, 
      name, 
      username, 
      location, 
      bio, 
      profilePicture,
      skills,
      jobTitle,
      company,
      yearsOfExperience
    } = req;

    if (!userId) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.USER_ID_REQUIRED
      );
    }

    // Build payload - include all fields that are provided
    // Empty strings mean "clear this field", empty array means "clear all skills"
    // undefined means "don't update this field"
    const payload: ProfileUpdatePayload = {};
    
    if (name !== undefined) payload.name = name || undefined;
    if (username !== undefined) payload.username = username || undefined;
    if (location !== undefined) payload.location = location || undefined;
    if (bio !== undefined) payload.bio = bio || undefined;
    if (profilePicture !== undefined) payload.profilePicture = profilePicture || undefined;
    // Skills: empty array is valid (clears all skills), undefined means don't update
    if (skills !== undefined) payload.skills = Array.isArray(skills) ? skills : [];
    if (jobTitle !== undefined) payload.jobTitle = jobTitle || undefined;
    if (company !== undefined) payload.company = company || undefined;
    if (yearsOfExperience !== undefined) payload.yearsOfExperience = yearsOfExperience || undefined;

    const updatedUser: UpdateProfileResponse =
      await this._authService.updateProfile(userId, payload);

    return updatedUser;
  }

  async verifyRefreshToken(
    call: VerifyRefreshTokenRequest
  ): Promise<VerifyRefreshTokenResponse> {
    // Validation handled by DTO (for HTTP) or GRPC validation
    const { email } = call;
    // Validation handled by DTO (for HTTP) or GRPC validation
    if (!email) {
       // Keep this for GRPC calls if they don't go through middleware
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Email is required");
    }

    const jwtpayload: JwtPayload = await this._authService.verifyUser(email);

    return {
      message: Messages.OK,
      jwtpayload,
    };
  }

  async getProfile(req: GetProfileRequest): Promise<GetProfileResponse> {
    const { userId } = req;

    if (!userId) {
      throw new CustomError(400, "User ID is required");
    }

    const userProfile: GetProfileResponse =
      await this._authService.getUserProfile(userId);

    return userProfile;
  }

  async generatePresignedUrl(
    call: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse> {
    const { userId, operation, fileName, fileType, key } = call;

    // Validation handled by DTO

    if (!userId) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        "User ID is required"
      );
    }

    const result = await this._authService.generatePresignedUrl(
      userId,
      operation,
      fileName,
      fileType,
      key
    );

    return { url: result.url, key: result.key!, expiresAt: result.expiresAt };
  }

  // google authentication
  googleAuth(req: Request, res: Response, next: NextFunction) {
    logger.info("Initiating Google OAuth");
    passport.authenticate("google", { scope: ["profile", "email"] }, (err) => {
      if (err) {
        logger.error("Google auth error", { error: err.message });
        return sendErrorResponse(res, {
          status: 500,
          message: "Google authentication failed",
        });
      }
      next();
    })(req, res, next);
  }

  googleCallback(req: Request, res: Response, next: NextFunction) {
    passport.authenticate(
      "google",
      { session: false },
      async (err, oauthUser) => {
        try {
          if (err) {
            logger.error("Google callback error", { error: err.message });
            throw new CustomError(500, "Google authentication failed");
          }
          if (!oauthUser) {
            logger.error("No user returned from Google OAuth");
            throw new CustomError(500, "No user data received");
          }
          logger.info("Google OAuth user", { email: oauthUser.email });
          const user: GetJwtUserResponse = await this._authService.handleOAuthLogin(
            oauthUser,
            res
          );
          // Set auth tokens (return value not needed for redirect flow)
          await setAuthToken(user, res);

          res.redirect(`${process.env.FRONTEND_URL}/success`);
        } catch (err: unknown) {
          logger.error("Google callback processing error", {
            error: (err as Error).message,
          });
          sendErrorResponse(
            res,
            err instanceof CustomError
              ? err
              : { status: 500, message: "Server error" }
          );
        }
      }
    )(req, res, next);
  }

  async getUserForFeedPost(
    req: getUserForFeedListingRequest
  ): Promise<getUserForFeedListingResponse> {
    const { userId } = req;

    if (!userId) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "userId is required");
    }

    const userFeedDetails: getUserForFeedListingResponse =
      await this._authService.getUserForFeedPostServic(userId);

    return userFeedDetails;
  }

  // ============================================
  // HTTP Controller Methods (for Express routes)
  // ============================================

  async signupHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.register(req.body);
      res.status(HttpStatus.CREATED).json({ message: response.message });
    } catch (err: unknown) {
      logger.error("Error in /auth/signup", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async verifyOtpHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.verifyOTP(req.body);
      if (response.jwtpayload) {
        // Generate tokens and set cookies, also get tokens for response
        const tokens = await setAuthToken(response.jwtpayload, res);
        
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {
            ...response.jwtpayload,
            accessToken: tokens?.accessToken, // Include in response for NextAuth
            refreshToken: tokens?.refreshToken, // Include in response for NextAuth
          },
        });
      } else {
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {},
        });
      }
    } catch (err: unknown) {
      logger.error("Error in /auth/verify-otp", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async resendOtpHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.resendOTP(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: unknown) {
      logger.error("Error in /auth/resend-otp", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async getMeHttp(req: Request, res: Response): Promise<void> {
    try {
      // Get userId from x-user-data header (set by API Gateway)
      const userData = req.headers["x-user-data"];
      const userId = userData ? JSON.parse(userData as string)?.id : undefined;
      
      if (!userId) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated",
        });
      }
      const response = await this.getCurrentUser({ userId });
      res.status(HttpStatus.OK).json(response);
    } catch (err: unknown) {
      logger.error("Error in /auth/me", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async loginHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/login request", { 
        body: { email: req.body?.email },
        headers: { contentType: req.headers["content-type"] }
      });
      const response = await this.login(req.body);
      if (response.jwtpayload) {
        // Generate tokens and set cookies, also get tokens for response
        const tokens = await setAuthToken(response.jwtpayload, res);
        
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {
            ...response.jwtpayload,
            accessToken: tokens?.accessToken, // Include in response for NextAuth
            refreshToken: tokens?.refreshToken, // Include in response for NextAuth
          },
        });
      } else {
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {},
        });
      }
    } catch (err: unknown) {
      logger.error("Error in /auth/login", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async logoutHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/logout request");
      const cookies = req.cookies || {};
      setJtiAsBlackListed(cookies);
      clearCookies(res);
      res.status(HttpStatus.OK).json({ success: true, message: Messages.LOGOUT_SUCCESS });
    } catch (err: unknown) {
      logger.error("Error in /auth/logout", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async requestPasswordResetHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/password-reset request", { body: req.body });
      const response = await this.requestPasswordReset(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: unknown) {
      logger.error("Error in /auth/password-reset", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async confirmPasswordResetHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/password-reset/confirm", { body: req.body });
      const response = await this.resetPassword(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: unknown) {
      logger.error("Error in /auth/password-reset/confirm", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async getProfileHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/profile request");
      // Get userId from x-user-data header (set by API Gateway)
      const userData = req.headers["x-user-data"];
      const userId = userData ? JSON.parse(userData as string)?.id : undefined;
      
      if (!userId) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated",
        });
      }
      const response = await this.getProfile({ userId });
      res.status(HttpStatus.OK).json(response);
    } catch (err: unknown) {
      logger.error("Error in /auth/profile", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async updateProfileHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/profile PATCH request", { body: req.body });
      // Get userId from x-user-data header (set by API Gateway)
      const userData = req.headers["x-user-data"];
      const userId = userData ? JSON.parse(userData as string)?.id : undefined;
      
      if (!userId) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated",
        });
      }
      const response = await this.updateProfile({ ...req.body, userId });
      res.status(HttpStatus.OK).json(response);
    } catch (err: unknown) {
      logger.error("Error in /auth/profile PATCH", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async refreshTokenHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/refresh request");
      
      // Get refresh token from cookies (or request body as fallback)
      const refreshToken = req.cookies?.refresh_token || req.body?.refreshToken;
      
      if (!refreshToken) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "Refresh token not found",
        });
      }
      
      // Verify the refresh token
      const decoded = await verifyRefreshToken(refreshToken);
      
      if (!decoded || !decoded.email) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "Invalid or expired refresh token",
        });
      }
      
      // Use the email from the decoded token to verify user and generate new tokens
      const response = await this.verifyRefreshToken({ email: decoded.email });
      
      if (response.jwtpayload) {
        const jti = generateUuid4();
        // Set access token cookie and get token for response
        const tokenResult = await setAccesToken(res, response.jwtpayload, jti);
        
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {
            ...response.jwtpayload,
            accessToken: tokenResult?.accessToken, // Include in response for NextAuth
          },
        });
      } else {
        res.status(HttpStatus.OK).json({
          message: response.message,
          user: {},
        });
      }
    } catch (err: unknown) {
      logger.error("Error in /auth/refresh", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }

  async generatePresignedUrlHttp(req: Request, res: Response): Promise<void> {
    try {
      // Get userId from x-user-data header (set by API Gateway)
      const userData = req.headers["x-user-data"];
      const userId = userData ? JSON.parse(userData as string)?.id : undefined;
      
      if (!userId) {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "User not authenticated",
        });
      }
      const response = await this.generatePresignedUrl({
        ...req.body,
        userId,
      });
      res.status(HttpStatus.OK).json({
        url: response.url,
        key: response.key,
        expiresAt: response.expiresAt,
      });
    } catch (err: unknown) {
      logger.error("Error in /auth/generate-presigned-url", { error: (err as Error).message });
      const statusCode = (err as any).status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: (err as Error).message || "Server error",
      });
    }
  }
}
