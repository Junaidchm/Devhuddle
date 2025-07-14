import jwt from "jsonwebtoken";
import { jwtPayload, jwtUserFilter, User } from "../types/auth";
import {logger} from "./logger";
import redisClient from "../utils/redis.util";
import { checkIsRevoked } from "./redis.actions";

const JWT_SECRET = process.env.JWT_SECRET as string;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 7;
const PASSWORD_RESET_TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

export const generateAccessToken = (user:jwtUserFilter,jti:string): string => {
  try {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        jti: jti,
      },
      process.env.ACCESS_TOKEN_SECRET as string,
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  } catch (error: any) {
    logger.error("Error generating access token", { error: error.message });
    throw new Error("Token generation failed");
  }
};

export const GenerateRefreshToken = (user: jwtUserFilter,jti:string): string => {
  try {
    const refreshToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        jti: jti,
      },
      process.env.REFRESH_TOKEN_SECRET!,
      {
        expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
      }
    );
    return refreshToken;
  } catch (err: any) {
    logger.error("Error generating refresh token", { error: err.message });
    throw new Error("Token generation failed");
  }
};

export const verifyRefreshToken = async (
  token: string
): Promise<jwtPayload | null> => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.REFRESH_TOKEN_SECRET as string
    ) as jwtPayload;
    const isRevoked = await checkIsRevoked(decoded.jti);
    if (isRevoked) {
      logger.error("Revoked refresh token used");
      return null;
    }
    return decoded;
  } catch (err: any) {
    logger.error("Invalid refresh token", { error: err.message });
    return null;
  }
};

export const revokeToken = async (
  jti: string,
  expiresInSeconds: number
): Promise<void> => {
  try {
    await redisClient.sadd("revoked_tokens", jti);
    await redisClient.expire("revoked_tokens", expiresInSeconds);
  } catch (err: any) {
    logger.error("Error revoking token", { error: err.message });
    throw new Error("Token revocation failed");
  }
};

export const verifyAccessToken = async (
  token: string
): Promise<jwtPayload | null> => {
  try {
    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET!
    ) as jwtPayload;
    const isRevoked = await checkIsRevoked(decoded.jti);
    if (isRevoked) {
      logger.error("Revoked access token used");
      return null;
    }
    return decoded;
  } catch (err: any) {
    // Invalid or expired token
    logger.error("Invalid refresh token", { error: err.message });
    return null;
  }
};

export const extractRefreshJti = (token: string): string => {
  const decode = jwt.decode(token) as jwtPayload;
  return decode.jti;
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

export const filterUserJwtPayload = (user: User): jwtUserFilter => {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  };
};


