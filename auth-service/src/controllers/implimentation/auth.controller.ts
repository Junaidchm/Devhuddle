import { NextFunction, Request, Response } from "express";
import { AuthService } from "../../services/impliments/auth.service";
import {
  jwtPayload,
  jwtUserFilter,
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  TokenResponse,
} from "../../types/auth";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import passport from "../../config/passport.config";
import { setAuthToken } from "../../utils/jwtHandler";
import { Messages } from "../../constents/reqresMessages";
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

export class AuthController implements IAuthController {
  constructor(private authService: IAuthService) {}

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

    const jwtpayload: JwtPayload = await this.authService.login({
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
    const { userId, name, username, location, bio, profilePicture } = req;

    if (!userId) {
      throw new CustomError(
        grpc.status.INVALID_ARGUMENT,
        Messages.USER_ID_REQUIRED
      );
    }
    const updatedUser: UpdateProfileResponse =
      await this.authService.updateProfile(userId, {
        name,
        username,
        location,
        bio,
        profilePicture,
      });

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
          const user: jwtUserFilter = await this.authService.handleOAuthLogin(
            oauthUser,
            res
          );
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
}
