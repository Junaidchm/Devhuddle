import jwt from "jsonwebtoken";
import { User } from "../types/auth";
import logger from "./logger.util";
import redisClient from "./redis.util";

const JWT_SECRET = process.env.JWT_SECRET as string;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;
const PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

export const generateAccessToken = (user: User): string => {
  try {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  } catch (error: any) {
    logger.error("Error generating access token", { error: error.message });
    throw new Error("Token generation failed");
  }
};

export const generateRefreshToken = async (userId: string): Promise<string> => {
  try {
    const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
      expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });
    await redisClient.setEx(
      `refresh:${userId}:${refreshToken}`,
      REFRESH_TOKEN_EXPIRY_DAYS * 24 * 3600,
      "1"
    );
    return refreshToken;
  } catch (err: any) {
    logger.error("Error generating refresh token", { error: err.message });
    throw new Error("Token generation failed");
  }
};

export const verifyRefreshToken = async (
  userId: string,
  token: string
): Promise<boolean> => {
  try {
    const stored = await redisClient.get(`refresh:${userId}:${token}`);
    if (!stored) {
      return false;
    }
    jwt.verify(token, JWT_SECRET);
    return true;
  } catch (err: any) {
    logger.error("Invalid refresh token", { error: err.message });
    return false;
  }
};

export const verifyAccessToken = (
  token: string
): {
  id: string;
  email?: string;
  username?: string;
  role?: string;
} | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email?: string;
      username?: string;
      role?: string;
    };
    return decoded;
  } catch (error) {
    // Invalid or expired token
    return null;
  }
};

export const generatePasswordResetToken = async (
  email: string
): Promise<string> => {
  try {
    const token = jwt.sign({ email }, JWT_SECRET, {
      expiresIn: PASSWORD_RESET_TOKEN_EXPIRY_SECONDS,
    });
    await redisClient.setEx(
      `reset:${email}`,
      PASSWORD_RESET_TOKEN_EXPIRY_SECONDS,
      token
    );
    return token;
  } catch (err: any) {
    logger.error("Error generating password reset token", {
      error: err.message,
    });
    throw new Error("Token generation failed");
  }
};

export const verifyPasswordResetToken = async (
  email: string,
  token: string
): Promise<boolean> => {
  try {
    const storedToken = await redisClient.get(`reset:${email}`);
    if (storedToken !== token) {
      return false;
    }
    jwt.verify(token, JWT_SECRET);
    await redisClient.del(`reset:${email}`);
    return true;
  } catch (err: any) {
    logger.error("Invalid password reset token", { error: err.message });
    return false;
  }
};
