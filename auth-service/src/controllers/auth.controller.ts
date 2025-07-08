import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service";
import {
  jwtPayload,
  jwtUserFilter,
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  RegisterRequest,
  TokenResponse,
  VerifyOTPRequest,
} from "../types/auth";
import { CustomError, sendErrorResponse } from "../utils/error.util";
import { HttpStatus } from "../constents/httpStatus";
import logger from "../utils/logger.util";
import passport from "../config/passport.config";
import { User } from "../generated/prisma";
import { clearCookies, setAccesToken, setAuthToken } from "../utils/jwtHandler";
import { Messages } from "../constents/reqresMessages";
import redisClient from "../utils/redis.util";
import { generateUuid4 } from "../utils/uuid.util";
import { setJtiAsBlackListed } from "../utils/redis.actions";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3.config";

export class AuthController {
  private authService: AuthService;
  constructor(authservice: AuthService = new AuthService()) {
    this.authService = authservice;
  }

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, username, name, password } = req.body as RegisterRequest;
      if (!email || !username || !password) {
        throw new CustomError(
          400,
          "Email, username, and password are required"
        );
      }

      await this.authService.register({ email, username, name, password });
      res
        .status(HttpStatus.CREATED)
        .json({ message: "User registered, please verify email with OTP" });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async verifyOTP(req: Request, res: Response) {
    try {
      const { email, otp } = req.body as VerifyOTPRequest;
      if (!email || !otp) {
        throw new CustomError(400, "Email and OTP are required");
      }

      const user: jwtUserFilter = await this.authService.verifyOTP({
        email,
        otp,
      });

      await setAuthToken(user, res);

      res.status(200).json({ message: "Email verified successfully" });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body as LoginRequest;
      if (!email || !password) {
        throw new CustomError(400, "Email and password are required");
      }

      const user: jwtUserFilter = await this.authService.login({
        email,
        password,
      });

      await setAuthToken(user, res);

      res.status(200).json({ message: "Login successful" });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async resendOTP(req: Request, res: Response) {
    try {
      console.log(req.body);
      const { email } = req.body;
      await this.authService.resendOTP(email);
      res.status(HttpStatus.OK).json({ message: "OTP resent successfully" });
    } catch (error: any) {
      sendErrorResponse(
        res,
        error instanceof CustomError
          ? error
          : { status: 500, message: "Server error" }
      );
    }
  }

  async getCurrentUser(req: Request, res: Response) {
    try {
      const decoded = req.user as jwtPayload;
      const user = await this.authService.getUserById(decoded.id);

      res.status(200).json({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
        profilePicture: user.profilePicture,
      });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body as PasswordResetRequest;
      if (!email) {
        throw new CustomError(400, "Email is required");
      }

      await this.authService.requestPasswordReset({ email });
      res
        .status(200)
        .json({ message: "Password reset email sent to your email" });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body as PasswordResetConfirmRequest;
      if (!token || !newPassword) {
        throw new CustomError(400, "Token and new password are required");
      }

      await this.authService.resetPassword({ token, newPassword });
      res.status(200).json({ message: "Password reset successful" });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user as OAuthUser;

      const {
        name,
        username,
        location,
        bio,
        profilePicture
      } = req.body;
      const updatedUser = await this.authService.updateProfile(user.id, {
        name,
        username,
        location,
        bio,
        profilePicture,
      });

      res.status(200).json(updatedUser);
    } catch (err: any) {
      logger.error("Profile update error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async verifyRefreshToken(req: Request, res: Response) {
    try {
      const decode = req.user as jwtPayload;

      const user: jwtUserFilter = await this.authService.verifyUser(
        decode.email!
      );

      await setAccesToken(res, user, generateUuid4());
      res.status(HttpStatus.OK).json({ message: Messages.OK });
    } catch (err: any) {
      logger.error("error in verifyRefreshToken", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  logoutUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const decoded = req.user as jwtPayload;

      // revoke both access and refresh tokens
      setJtiAsBlackListed(req.cookies);
      //clear cookies
      clearCookies(res);

      res
        .status(HttpStatus.OK)
        .json({ success: true, message: Messages.LOGOUT_SUCCESS });
    } catch (err: any) {
      logger.error("error in Logout user", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  };

  async getProfile(req: Request, res: Response) {
    try {
      const decoded = req.user as jwtPayload;

      const user = await this.authService.getUserById(decoded.id);

      res.status(200).json({
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
        role: user.role,
        profilePicture: user.profilePicture,
        location: user.location,
        bio: user.bio,
        skills: user.skills,
        yearsOfExperience: user.yearsOfExperience,
        jobTitle: user.jobTitle,
        company: user.company,
      });
    } catch (err: any) {
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  // generate presigned url
  async generatePresignedUrl(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user as OAuthUser;
      const { operation, fileName, fileType, key } = req.body;

      if (!["PUT", "GET"].includes(operation)) {
        throw new CustomError(
          HttpStatus.BAD_REQUEST,
          Messages.PRESIGNED_URL_GETPUT_ERROR
        );
      }

      const result = await this.authService.generatePresignedUrl(
        user.id,
        operation,
        fileName,
        fileType,
        key
      );

      const { url, key: presignedKey , expiresAt } = result;
      res.status(200).json({ url, key: presignedKey,expiresAt });
    } catch (err: any) {
      logger.error("Generate presigned URL error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Failed to generate presigned URL" }
      );
    }
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
}
