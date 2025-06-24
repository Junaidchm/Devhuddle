import {
  ISessionRepository,
  SessionRepository,
} from "../repositories/session.repository";
import {
  IUserRepository,
  UserRepository,
} from "../repositories/user.repository";
import {
  LoginRequest,
  OAuthUser,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  ProfileUpdatePayload,
  RegisterRequest,
  TokenResponse,
  User,
  VerifyOTPRequest,
} from "../types/auth";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../utils/email.util";
import { CustomError } from "../utils/error.util";
import {
  generateAccessToken,
  generatePasswordResetToken,
  generateRefreshToken,
  verifyPasswordResetToken,
} from "../utils/jwt.util";
import logger from "../utils/logger.util";
import { generateOTP, storeOTP, verifyOTP } from "../utils/otp.util";
import jwt from "jsonwebtoken";
import path from "path";
import fs from "fs";

export class AuthService {
  private userRepository: IUserRepository;
  private sessionRepository: ISessionRepository;

  constructor(
    userRepository: IUserRepository = new UserRepository(),
    sessionRepository: ISessionRepository = new SessionRepository()
  ) {
    this.userRepository = userRepository;
    this.sessionRepository = sessionRepository;
  }

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

  async verifyOTP({ email, otp }: VerifyOTPRequest): Promise<TokenResponse> {
    try {
      const isValid = await verifyOTP(email, otp);
      if (!isValid) {
        throw new CustomError(400, "Invalid or expired OTP");
      }

      const user = await this.userRepository.updateEmailVerified(email, true);
      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user.id);
      await this.sessionRepository.createSession(user.id, refreshToken);

      logger.info("Email verified", { email });
      return { accessToken };
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
      console.log(".......... user found this is the user :  ", user);
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

  async login({ email, password }: LoginRequest): Promise<TokenResponse> {
    try {
      const user = await this.userRepository.findByEmail(email);
      if(user && user.email === email && !password) {
        throw new CustomError(500, "You are already Loged In , please login using google");
      }
      if (
        !user ||
        !(await this.userRepository.verifyPassword(user.password, password))
      ) {
        throw new CustomError(401, "Invalid credentials");
      }
      if (!user.emailVerified) {
        throw new CustomError(403, "Email not verified");
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user.id);
      await this.sessionRepository.createSession(user.id, refreshToken);

      logger.info("User logged in", { email });
      return { accessToken };
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
        return;
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
  async handleOAuthLogin(oauthUser: OAuthUser): Promise<TokenResponse> {
    try {
      let user = await this.userRepository.findByEmail(oauthUser.email);
      if (!user) {
        user = await this.userRepository.createOAuthUser(oauthUser);
        logger.info("OAuth user created", { email: oauthUser.email });
      }

      const accessToken = generateAccessToken(user);
      const refreshToken = await generateRefreshToken(user.id);
      await this.sessionRepository.createSession(user.id, refreshToken);

      logger.info("OAuth login successful", { email: oauthUser.email });
      return { accessToken };
    } catch (err: any) {
      throw err instanceof CustomError
        ? err
        : new CustomError(500, "OAuth login failed");
    }
  }

  ///////// update profile
  async updateProfile(userId: string, data: ProfileUpdatePayload) {
    const {
      name,
      username,
      location,
      bio,
      skills,
      yearsOfExperience,
      jobTitle,
      company,
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
    if (profilePicture && profilePicture.size > 1024 * 1024) {
      throw new CustomError(400, "Profile picture must be less than 1MB");
    }
    if (skills && !Array.isArray(skills)) {
      throw new CustomError(400, "Skills must be an array");
    }

    // Save profile picture to local storage
    let profilePicturePath: string | undefined;
    if (profilePicture) {
      const uploadDir = process.env.UPLOAD_DIR || "uploads/profiles";
      const fileName = `${userId}-${Date.now()}${path.extname(
        profilePicture.originalname
      )}`;
      const filePath = path.join(uploadDir, fileName);

      // Ensure upload directory exists
      fs.mkdirSync(uploadDir, { recursive: true });
      fs.writeFileSync(filePath, profilePicture.buffer);

      profilePicturePath = filePath;
    }

    const updatedFields = {
      name,
      username,
      location,
      bio,
      skills,
      yearsOfExperience,
      jobTitle,
      company,
      profilePicture : profilePicturePath,
    };

    // Remove undefined fields
    const filteredFields = Object.fromEntries(
      Object.entries(updatedFields).filter(([_, value]) => value !== undefined)
    );

    // Update user
    const updatedUser = await this.userRepository.updateProfile(userId,filteredFields);

    return {
      id: updatedUser.id,
      username: updatedUser.username,
      name: updatedUser.name,
      role: updatedUser.role,
      profilePicture: updatedUser.profilePicture,
      location: updatedUser.location,
      bio: updatedUser.bio,
      skills: updatedUser.skills,
      yearsOfExperience: updatedUser.yearsOfExperience,
      jobTitle: updatedUser.jobTitle,
      company: updatedUser.company,
    };
  }
}
