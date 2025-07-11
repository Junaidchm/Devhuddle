import { Request, Response } from "express";
import {
  IUserRepository,
  UserRepository,
} from "../repositories/user.repository";
import {
  jwtPayload,
  jwtUserFilter,
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  ProfileUpdatePayload,
  RegisterRequest,
  User,
  VerifyOTPRequest,
} from "../types/auth";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/email.util";
import { CustomError } from "../utils/error.util";

import logger from "../utils/logger.util";
import { generateOTP, storeOTP, verifyOTP } from "../utils/otp.util";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { setAuthToken } from "../utils/jwtHandler";
import {
  filterUserJwtPayload,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from "../utils/jwt.util";
import { HttpStatus } from "../constents/httpStatus";
import { Messages } from "../constents/reqresMessages";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../config/s3.config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { IAuthService } from "./interface/IauthService";


export class AuthService implements IAuthService {

  constructor(private userRepository: IUserRepository) {}

  ////////// user Signup

  async register({
    email,
    username,
    name,
    password,
  }: RegisterRequest): Promise<void> {
    try {
      const existingUser = await this.userRepository.findByEmail(email);
      console.log(
        "this is the existing user .....................",
        existingUser
      );
      if (existingUser) {
        throw new CustomError(400, "Email already exists");
      }

      const existingUsername = await this.userRepository.findByUsername(
        username
      );
      if (existingUsername) {
        throw new CustomError(400, "Username already exists");
      }

      await this.userRepository.createUser(email, username, name, password);
      const otp = generateOTP();
      await storeOTP(email, otp);
      await sendVerificationEmail(email, otp);

      logger.info("User registered, OTP sent", { email, username });
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Registration failed");
    }
  }

  //////////// verify otp

  async verifyOTP({ email, otp }: VerifyOTPRequest): Promise<jwtUserFilter> {
    try {
      const isValid = await verifyOTP(email, otp);
      if (!isValid) {
        throw new CustomError(400, "Invalid or expired OTP");
      }

      const user = await this.userRepository.updateEmailVerified(email, true);

      logger.info("Email verified", { email });
      return filterUserJwtPayload(user);
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "OTP verification failed");
    }
  }

  ////////// resend otp

  async resendOTP(email: string) {
    try {
      const user = await this.userRepository.findByEmail(email);
      if (!user) {
        throw new CustomError(404, "User not found");
      }

      const otp = generateOTP();
      await storeOTP(email, otp);
      await sendVerificationEmail(email, otp);
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "OTP verification failed");
    }
  }

  //////////// get User

  async getUserById(id: string): Promise<User> {
    try {
      const user = await this.userRepository.findByIdUser(id);
      if (!user) {
        throw new CustomError(404, "User not found");
      }
      return user;
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Failed to fetch user");
    }
  }

  //////////// user login

  async login({ email, password }: LoginRequest): Promise<jwtUserFilter> {
    try {
      const user = await this.userRepository.findByEmail(email);

      if (user && user.email === email && !user.password) {
        throw new CustomError(
          500,
          "This account was created using Google. Please login using Google."
        );
      }
      if (
        !user ||
        !(await this.userRepository.verifyPassword(user.password, password))
      ) {
        throw new CustomError(404, "User Not Found");
      }
      if (!user.emailVerified) {
        throw new CustomError(403, "Email not verified");
      }

      if (user.isBlocked) {
        throw new CustomError(HttpStatus.FORBIDDEN, "User blocke by admin");
      }

      logger.info("User logged in", { email });
      return filterUserJwtPayload(user);
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Login failed");
    }
  }

  ///////// reset password request
  async requestPasswordReset({ email }: PasswordResetRequest): Promise<void> {
    try {
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        logger.warn("Password reset requested for non-existent email", {
          email,
        });
        throw new CustomError(404, "No account found with this email address.");
      }

      const token = await generatePasswordResetToken(email);
      await sendPasswordResetEmail(email, token);
      logger.info("Password reset token sent", { email });
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Password reset request failed");
    }
  }

  ////////// reset password
  async resetPassword({
    token,
    newPassword,
  }: PasswordResetConfirmRequest): Promise<void> {
    try {
      const decoded = jwt.decode(token) as { email: string };
      if (!decoded?.email) {
        throw new CustomError(400, "Invalid token");
      }

      const isValid = await verifyPasswordResetToken(decoded.email, token);
      if (!isValid) {
        throw new CustomError(400, "Invalid or expired reset token");
      }

      await this.userRepository.updatePassword(decoded.email, newPassword);
      logger.info("Password reset successful", { email: decoded.email });
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Password reset failed");
    }
  }

  ///////// handle authLogin
  async handleOAuthLogin(
    oauthUser: OAuthUser,
    res: Response
  ): Promise<jwtUserFilter> {
    try {
      let user = await this.userRepository.findByEmail(oauthUser.email);
      if (!user) {
        user = await this.userRepository.createOAuthUser(oauthUser);
        logger.info("OAuth user created", { email: oauthUser.email });
      }
      logger.info("OAuth login successful", { email: oauthUser.email });
      return filterUserJwtPayload(user);
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "OAuth login failed");
    }
  }

  //////// verify User
  async verifyUser(email: string): Promise<jwtUserFilter> {
    try {
      const user = await this.userRepository.findByEmail(email);

      if (!user) {
        throw new CustomError(HttpStatus.NOT_FOUND, Messages.USER_NOT_FOUND);
      }

      if (user?.isBlocked) {
        throw new CustomError(HttpStatus.FORBIDDEN, "User blocked");
      }

      return filterUserJwtPayload(user);
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "Refresh creation faild");
    }
  }

  ///////// update profile
  async updateProfile(userId: string, data: ProfileUpdatePayload) {
    const {
      name,
      username,
      location,
      bio,
      profilePicture,
    } = data;

    if (username) {
      const existingUsername = await this.userRepository.findByUsername(
        username
      );
      if (existingUsername && existingUsername.id !== userId) {
        throw new CustomError(400, "Username already taken");
      }
    }

    const updatedFields = {
      name,
      username,
      location,
      bio,
      profilePicture
    };

    // Remove undefined fields
    const filteredFields = Object.fromEntries(
      Object.entries(updatedFields).filter(([_, value]) => value !== undefined)
    );

    // Update user
    const updatedUser = await this.userRepository.updateProfile(
      userId,
      filteredFields
    );

    return updatedUser
  }

  async generatePresignedUrl(
    userId: string,
    operation: string,
    fileName?: string,
    fileType?: string,
    key?: string
  ) {
    try {
      const EXPIRES_IN_SECONDS = Number(process.env.EXPIRES_IN_SECONDS);
      console.log("..............this is the file type :", fileType, fileName);
      if (operation === "PUT") {
        if (!fileName || !fileType) {
          throw new CustomError(
            400,
            "fileName and fileType are required for PUT operation"
          );
        }
        const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
        if (!allowedTypes.includes(fileType)) {
          throw new CustomError(
            400,
            "Invalid file type. Only JPG, PNG, or GIF allowed"
          );
        }

        console.log(
          fileName.split(".").pop()?.toLowerCase(),
          fileType.split("/")[1]
        );
        const extension = fileName.split(".").pop()?.toLowerCase();
        const mimeType = fileType.split("/")[1].toLowerCase();

        // Handle jpg and jpeg as equal
        const equivalent = (ext: string, type: string) => {
          if (ext === "jpg" && type === "jpeg") return true;
          if (ext === "jpeg" && type === "jpg") return true;
          return ext === type;
        };

        if (!equivalent(extension!, mimeType)) {
          throw new CustomError(
            400,
            "File extension does not match content type"
          );
        }

        const newKey = `profiles/${userId}-${Date.now()}${path.extname(
          fileName
        )}`;

        const command = new PutObjectCommand({
          Bucket: "devhuddle-bucket-junaid",
          Key: newKey,
          ContentType: fileType,
        });
        const url = await getSignedUrl(s3Client, command, {
          expiresIn: EXPIRES_IN_SECONDS,
        });

        console.log("this is the url :", url);

        return {
          url,
          key: newKey,
          expiresAt: Date.now() + EXPIRES_IN_SECONDS * 1000,
        };
      } else if (operation === "GET") {
        if (!key) {
          throw new CustomError(400, "key is required for GET operation");
        }
        const command = new GetObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: key,
        });

        const url = await getSignedUrl(s3Client, command, {
          expiresIn: EXPIRES_IN_SECONDS,
        });
        return {
          url,
          presignedKey: key,
          expiresAt: Date.now() + EXPIRES_IN_SECONDS * 1000,
        };
      } else {
        throw new CustomError(400, "Invalid operation. Use PUT or GET");
      }
    } catch (error: any) {
      logger.error("Failed to generate presigned URL", {
        error: error.message,
      });
      throw error instanceof CustomError
        ? error
        : new CustomError(500, "Failed to generate presigned URL");
    }
  }
}
