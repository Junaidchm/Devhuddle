import { NextFunction, Request, Response } from "express";
import { AuthService } from "../../services/impliments/auth.service";
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
  constructor(private authService: IAuthService) {}


  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;

      if (!query || query.trim().length < 2) {
        res.status(HttpStatus.OK).json([]);
        return;
      }

      const users: Partial<User>[] = await this.authService.searchUsers(
        query,
        currentUserId
      );
      res.status(HttpStatus.OK).json(users);
    } catch (err: any) {
      logger.error("Search users error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  async register(req: RegisterRequest): Promise<RegisterResponse> {
    const { name, username, email, password } = req;
    if (!email || !username || !password) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.EMAIL_USERNAME_PASSWORD_REQUIRED
      );
    }
    await this.authService.register({ email, username, name, password });

    return { message: Messages.VERIFY_EMAIL_WITH_OTP };
  }

  async verifyOTP(req: VerifyOTPRequest): Promise<VerifyOTPResponse> {
    const { email, otp } = req;
    if (!email || !otp) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.EMAIL_OTP_REQUIRED
      );
    }

    const jwtpayload: JwtPayload = await this.authService.verifyOTP(req);
    return {
      message: Messages.EMAIL_VERIFIED,
      jwtpayload,
    };
  }

  async login(req: LogingRequest): Promise<LogingResponse> {
    const { email, password } = req;

    if (!email || !password) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.EMAIL_PASSWORD_REQUIRED
      );
    }

    const jwtpayload: GetJwtUserResponse = await this.authService.login({
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
    if (!email) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.EMAIL_MISSING
      );
    }
    await this.authService.resendOTP(email);
    return { message: Messages.OTP_RESENT };
  }

  async getCurrentUser(req: GetJwtUserRequest): Promise<GetJwtUserResponse> {
    const user = await this.authService.getJwtPayload(req.userId);
    return user;
  }

  async requestPasswordReset(
    req: PasswordResetRequest
  ): Promise<PasswordResetResponse> {
    const { email } = req;
    if (!email) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.EMAIL_MISSING
      );
    }

    await this.authService.requestPasswordReset({ email });
    return { message: Messages.PASSWORD_SENDTO_MAIL };
  }

  async resetPassword(req: PasswordResetConfirmRequest) {
    const { token, newPassword } = req;
    if (!token || !newPassword) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.PASSWORD_RESET_TOKEN_PASSWORD
      );
    }

    await this.authService.resetPassword({ token, newPassword });
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
      await this.authService.updateProfile(userId, payload);

    return updatedUser;
  }

  async verifyRefreshToken(
    call: VerifyRefreshTokenRequest
  ): Promise<VerifyRefreshTokenResponse> {
    const { email } = call;

    if (!email) {
      throw new CustomError(grpc.status.INVALID_ARGUMENT, "Email is required");
    }

    const jwtpayload: JwtPayload = await this.authService.verifyUser(email);

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
      await this.authService.getUserProfile(userId);

    return userProfile;
  }

  async generatePresignedUrl(
    call: GeneratePresignedUrlRequest
  ): Promise<GeneratePresignedUrlResponse> {
    const { userId, operation, fileName, fileType, key } = call;

    if (!["PUT", "GET"].includes(operation)) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.PRESIGNED_URL_GETPUT_ERROR
      );
    }

    if (!userId) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        "User ID is required"
      );
    }

    const result = await this.authService.generatePresignedUrl(
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
          const user: GetJwtUserResponse = await this.authService.handleOAuthLogin(
            oauthUser,
            res
          );
          // Set auth tokens (return value not needed for redirect flow)
          await setAuthToken(user, res);

          res.redirect(`${process.env.FRONTEND_URL}/success`);
        } catch (err: any) {
          logger.error("Google callback processing error", {
            error: err.message,
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
      await this.authService.getUserForFeedPostServic(userId);

    return userFeedDetails;
  }

  // ============================================
  // HTTP Controller Methods (for Express routes)
  // ============================================

  async signupHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.register(req.body);
      res.status(HttpStatus.CREATED).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/signup", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/verify-otp", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async resendOtpHttp(req: Request, res: Response): Promise<void> {
    try {
      const response = await this.resendOTP(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/resend-otp", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/me", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/login", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/logout", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async requestPasswordResetHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/password-reset request", { body: req.body });
      const response = await this.requestPasswordReset(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/password-reset", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }

  async confirmPasswordResetHttp(req: Request, res: Response): Promise<void> {
    try {
      logger.info("Received /auth/password-reset/confirm", { body: req.body });
      const response = await this.resetPassword(req.body);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/password-reset/confirm", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/profile", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/profile PATCH", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/refresh", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
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
    } catch (err: any) {
      logger.error("Error in /auth/generate-presigned-url", { error: err.message });
      const statusCode = err.status || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: err.message || "Server error",
      });
    }
  }
}
