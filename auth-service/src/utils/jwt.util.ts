import jwt from "jsonwebtoken";
import { User } from "../types/auth";
import logger from "./logger.util";
import redisClient from "./redis.util";
// import { encryptData } from "../encription";
// import { generateRedisKey, generateTTL, setCache } from "./redis.actions";

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
      (process.env.ACCESS_TOKEN_SECRET as string),
      { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
  } catch (error: any) {
    logger.error("Error generating access token", { error: error.message });
    throw new Error("Token generation failed");
  }
};

// export const saveRefreshToken = async (
//   token: string,
//   encryptedToken:string,
// ) => {
//   try {
//     const decodedData = jwt.decode(token, { json: true });
//     if (!decodedData) throw new Error("Unable to decode token");
//     const key = generateRedisKey(decodedData.id);
//     const TTL = generateTTL(decodedData.exp!);
//     await setCache(key,encryptedToken, TTL);
//     console.log("Saved Refresh Token");
//   } catch (error) {
//     console.log("Error in saving refresh token: ", error);
//     throw error;
//   }
// };

export const GenerateRefreshToken = (user:User): string=> {
  try {
    const refreshToken = jwt.sign({
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
      }, process.env.REFRESH_TOKEN_SECRET!, {
      expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
    });
    return refreshToken;
  } catch (err: any) {
    logger.error("Error generating refresh token", { error: err.message });
    throw new Error("Token generation failed");
  }
};


// export const generateRefreshToken = async (userId: string): Promise<string> => {
//   try {
//     const refreshToken = jwt.sign({ userId }, JWT_SECRET, {
//       expiresIn: `${REFRESH_TOKEN_EXPIRY_DAYS}d`,
//     });

//     // const encryptedRefreshToken = encryptData(refreshToken)
//     await redisClient.setEx(
//       `refresh:${userId}:${refreshToken}`,
//       REFRESH_TOKEN_EXPIRY_DAYS * 24 * 3600,
//       "1"
//     );
//     return refreshToken;
//   } catch (err: any) {
//     logger.error("Error generating refresh token", { error: err.message });
//     throw new Error("Token generation failed");
//   }
// };

export const verifyRefreshToken = async (
  userId: string,
  token: string
): Promise<boolean> => {
  try {
    // const stored = await redisClient.get(`refresh:${userId}:${token}`);
    // if (!stored) {
    //   return false;
    // }
    jwt.verify(token, process.env.REFRESH_TOKEN_SECRET as string);
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
