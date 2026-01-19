import { Request, Response } from "express";
import {
  jwtUserFilter,
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  ProfileUpdatePayload,
  RegisterRequest,
  User,
  VerifyOTPRequest,
} from "../../types/auth";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../../utils/email.util";
import { CustomError } from "../../utils/error.util";

import logger from "../../utils/logger.util";
import { generateOTP, storeOTP, verifyOTP } from "../../utils/otp.util";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";
import { setAuthToken } from "../../utils/jwtHandler";
import {
  filterUserJwtPayload,
  filterUserProfileData,
  generatePasswordResetToken,
  verifyPasswordResetToken,
} from "../../utils/jwt.util";
import { HttpStatus } from "../../constents/httpStatus";
import { Messages } from "../../constents/reqresMessages";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client } from "../../config/s3.config";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { IAuthService } from "../interface/IauthService";
import {
  GetJwtUserResponse,
  GetProfileResponse,
  JwtPayload,
  PasswordResetRequest,
  UpdateProfileResponse,
} from "../../grpc/generated/auth";
import * as grpc from "@grpc/grpc-js";
import { getUserForFeedListingResponse } from "../../grpc/generated/user";
import { IUserRepository } from "../../repositories/interfaces/IUserRepository";

export class AuthService implements IAuthService {
  constructor(private _userRepository: IUserRepository) {}


  async searchUsers(
    query: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    // Delegate the search to the repository
    return this._userRepository.searchUsers(query, currentUserId);
  }

  ////////// user Signup

  async register({
    email,
    username,
    name,
    password,
  }: RegisterRequest): Promise<void> {
    try {
      const existingUser = await this._userRepository.findByEmail(email);
      if (existingUser) {
        throw new CustomError(grpc.status.ALREADY_EXISTS, Messages.EMAIL_EXIST);
      }

      const existingUsername = await this._userRepository.findByUsername(
        username
      );
      if (existingUsername) {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          Messages.USERNAME_EXISTS
        );
      }

      await this._userRepository.createUser(email, username, name, password);
      const otp = generateOTP();
      await storeOTP(email, otp);
      await sendVerificationEmail(email, otp);

      logger.info("User registered, OTP sent", { email, username });
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, Messages.REGISTRATION_FAILD);
    }
  }

  //////////// verify otp

  async verifyOTP({ email, otp }: VerifyOTPRequest): Promise<JwtPayload> {
    try {
      const isValid = await verifyOTP(email, otp);
      if (!isValid) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid or expired OTP"
        );
      }

      const user = await this._userRepository.updateEmailVerified(email, true);

      logger.info("Email verified", { email });
      return filterUserJwtPayload(user);
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(
            grpc.status.INTERNAL,
            Messages.OTP_VERIFICATION_FAILD
          );
    }
  }

  ////////// resend otp

  async resendOTP(email: string) {
    try {
      const user = await this._userRepository.findByEmail(email);
      if (!user) {
        throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
      }

      const otp = generateOTP();
      await storeOTP(email, otp);
      await sendVerificationEmail(email, otp);
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(
            grpc.status.INTERNAL,
            Messages.OTP_VERIFICATION_FAILD
          );
    }
  }

  //////////// get User

  async getJwtPayload(id: string): Promise<GetJwtUserResponse> {
    try {
      const user = await this._userRepository.findByIdUser(id);
      if (!user) {
        throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
      }
      return filterUserProfileData(user, "jwt") as GetJwtUserResponse;
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, Messages.FAILD_TO_FETCH_USER);
    }
  }

  //////////// user login
  // Note: This endpoint is used for both user and admin login
  // Role validation for admin access happens on the client side (NextAuth) and in middleware
  // The backend returns the user's role in the JWT payload, and the client validates it
  async login({ email, password }: LoginRequest): Promise<GetJwtUserResponse> {
    try {
      const user = await this._userRepository.findByEmail(email);

      if (user && user.email === email && user.password == "") {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          Messages.LOGING_USING_GOOGLE_MESSAGE
        );
      }
      if (
        !user ||
        !(await this._userRepository.verifyPassword(user.password, password))
      ) {
        throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
      }
      if (!user.emailVerified) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          Messages.VERIFIED_EMAIL_ERR
        );
      }

      if (user.isBlocked) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          Messages.USER_BLOCKED
        );
      }

      return filterUserJwtPayload(user);
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, Messages.LOGING_FAILD);
    }
  }

  ///////// reset password request
  async requestPasswordReset({ email }: PasswordResetRequest): Promise<void> {
    try {
      const user = await this._userRepository.findByEmail(email);

      if (!user) {
        logger.warn("Password reset requested for non-existent email", {
          email,
        });
        throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
      }

      const token = await generatePasswordResetToken(email);
      await sendPasswordResetEmail(email, token);
      logger.info("Password reset token sent", { email });
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(
            grpc.status.INTERNAL,
            Messages.PASSWORD_REQUEST_FAILD
          );
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
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          Messages.TOKEN_INVALID
        );
      }

      const isValid = await verifyPasswordResetToken(decoded.email, token);
      if (!isValid) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid or expired reset token"
        );
      }

      await this._userRepository.updatePassword(decoded.email, newPassword);
      logger.info("Password reset successful", { email: decoded.email });
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Password reset failed");
    }
  }

  ///////// handle authLogin
  async handleOAuthLogin(
    oauthUser: OAuthUser,
    res: Response
  ): Promise<GetJwtUserResponse> {
    try {
      let user = await this._userRepository.findByEmail(oauthUser.email);
      if (!user) {
        user = await this._userRepository.createOAuthUser(oauthUser);
        logger.info("OAuth user created", { email: oauthUser.email });
      }
      logger.info("OAuth login successful", { email: oauthUser.email });
      return filterUserJwtPayload(user);
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "OAuth login failed");
    }
  }

  //////// verify User
  async verifyUser(email: string): Promise<JwtPayload> {
    try {
      const user = await this._userRepository.findByEmail(email);

      if (!user) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          Messages.USER_NOT_FOUND
        );
      }

      if (user?.isBlocked) {
        throw new CustomError(
          grpc.status.PERMISSION_DENIED,
          Messages.USER_BLOCKED
        );
      }

      return filterUserJwtPayload(user);
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, "Refresh creation faild");
    }
  }

  ///////// get user profile
  async getUserProfile(id: string): Promise<GetProfileResponse> {
    try {
      const user = await this._userRepository.findByIdUser(id);
      if (!user) {
        throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
      }
      return filterUserProfileData(user, "profile") as GetProfileResponse;
    } catch (err: unknown) {
      throw err instanceof CustomError
        ? err
        : new CustomError(grpc.status.INTERNAL, Messages.FAILD_TO_FETCH_USER);
    }
  }

  async getUserForFeedPostServic(userId: string): Promise<getUserForFeedListingResponse> {
      try {
        const user = await this._userRepository.findByIdUser(userId);
        if (!user) {
          throw new CustomError(grpc.status.NOT_FOUND, Messages.USER_NOT_FOUND);
        }
        return {
          name: user.name,
          username: user.username,
          avatar: user.profilePicture || "",
        };
      } catch (err: unknown) {
        throw err instanceof CustomError
          ? err
          : new CustomError(grpc.status.INTERNAL, Messages.FAILD_TO_FETCH_USER);
      }
  }

  ///////// update profile
  async updateProfile(
    userId: string,
    data: ProfileUpdatePayload
  ): Promise<UpdateProfileResponse> {
    const { 
      name, 
      username, 
      location, 
      bio, 
      profilePicture,
      skills,
      jobTitle,
      company,
      yearsOfExperience
    } = data;

    // Validate username uniqueness if username is being updated
    if (username) {
      const existingUsername = await this._userRepository.findByUsername(
        username
      );
      if (existingUsername && existingUsername.id !== userId) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          Messages.USERNAME_EXISTS
        );
      }
    }

    // Validate skills array if provided
    if (skills !== undefined) {
      if (!Array.isArray(skills)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Skills must be an array"
        );
      }
      if (skills.length > 20) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Maximum 20 skills allowed"
        );
      }
      // Validate each skill
      for (const skill of skills) {
        if (typeof skill !== 'string' || skill.trim().length === 0) {
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
            "Skills must be non-empty strings"
          );
        }
        if (skill.length > 50) {
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
            "Each skill must be at most 50 characters"
          );
        }
      }
    }

    // Build update fields object
    const updatedFields: Partial<User> = {
      name,
      username,
      location,
      bio,
      profilePicture,
      skills,
      jobTitle,
      company,
      yearsOfExperience,
    };

    // Remove undefined fields to avoid overwriting with undefined
    const filteredFields = Object.fromEntries(
      Object.entries(updatedFields).filter(([_, value]) => value !== undefined)
    ) as Partial<User>;

    // Update user
    const updatedUser = await this._userRepository.updateProfile(
      userId,
      filteredFields
    );

    // Return updated profile response
    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      name: updatedUser.name,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture || "",
      location: updatedUser.location || "",
      bio: updatedUser.bio || "",
      skills: updatedUser.skills || [],
      jobTitle: updatedUser.jobTitle || "",
      company: updatedUser.company || "",
      yearsOfExperience: updatedUser.yearsOfExperience || "",
      emailVerified: updatedUser.emailVerified,
    };
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
            grpc.status.INVALID_ARGUMENT,
            "fileName and fileType are required for PUT operation"
          );
        }
        const allowedTypes = ["image/jpeg", "image/png", "image/gif"];
        if (!allowedTypes.includes(fileType)) {
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
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
            grpc.status.INVALID_ARGUMENT,
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
          throw new CustomError(
            grpc.status.INVALID_ARGUMENT,
            "key is required for GET operation"
          );
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
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          "Invalid operation. Use PUT or GET"
        );
      }
    } catch (error: unknown) {
      logger.error("Failed to generate presigned URL", {
        error: (error as Error).message,
      });
      throw error instanceof CustomError
        ? error
        : new CustomError(
            grpc.status.INTERNAL,
            "Failed to generate presigned URL"
          );
    }
  }
}
