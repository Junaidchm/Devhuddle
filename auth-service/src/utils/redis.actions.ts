import logger from "./logger.util";
import redisClient, { generateBlockUserRedisKey } from "./redis.util";
import jwt from "jsonwebtoken";

export const checkIsRevoked = async (jti: string): Promise<boolean> => {
  try {
    const key = `revoked:${jti}`;
    const exists = await redisClient.exists(key);

    logger.info(`Checked revoked status for jti: ${jti} → ${exists === 1}`);
    return exists === 1;
  } catch (error) {
    logger.error("Error checking if token is revoked", {
      jti,
      error: (error as Error).message,
    });
    throw new Error("Failed to check token revocation status");
  }
};

// Extract jti values from cookies object
const extractRefreshAndAccess = (
  cookies: Record<string, any>
): { jtiAccess?: string; jtiRefresh?: string } => {
  const accessToken = cookies.access_token;
  const refreshToken = cookies.refresh_token;

  const jtiAccess = accessToken
    ? (jwt.decode(accessToken) as any)?.jti
    : undefined;
  const jtiRefresh = refreshToken
    ? (jwt.decode(refreshToken) as any)?.jti
    : undefined;

  return { jtiAccess, jtiRefresh };
};

//  Blacklist access and refresh tokens using jti values from cookies
export const setJtiAsBlackListed = async (
  cookies: Record<string, any>
): Promise<void> => {
  try {
    const { jtiAccess, jtiRefresh } = extractRefreshAndAccess(cookies);

    if (!jtiAccess && !jtiRefresh) {
      logger.warn("No valid jti found in provided cookies.");
      return;
    }

    if (jtiAccess) {
      await redisClient.setEx(`revoked:${jtiAccess}`, 60 * 60, "true"); // 1 hour
      logger.info(`Access token jti ${jtiAccess} blacklisted for 1 hour`);
    }

    if (jtiRefresh) {
      await redisClient.setEx(
        `revoked:${jtiRefresh}`,
        7 * 24 * 60 * 60,
        "true"
      ); // 7 days
      logger.info(`Refresh token jti ${jtiRefresh} blacklisted for 7 days`);
    }
  } catch (error) {
    logger.error("Error blacklisting tokens", {
      error: (error as Error).message,
    });
    throw new Error("Failed to blacklist tokens");
  }
};

// black list blocked user by superAdmin

export const setUsertoBlockBlackList = async (
  userId: string,
  isBlocked: boolean
) => {
  try {
    const key = generateBlockUserRedisKey(userId);
    if (isBlocked) {
      await redisClient.setEx(key, 900, "1");
    } else {
      await redisClient.del(key);
    }
  } catch (error: any) {
    logger.error("Error blacklisting User", {
      error: (error as Error).message,
    });
    throw new Error("Failed to blacklist User");
  }
};

export const checkUserBlockBlackList = async (
  userId: string
): Promise<boolean> => {
  try {
    const key = generateBlockUserRedisKey(userId);
    const isBlackListed = await redisClient.get(key);
    if (isBlackListed) {
      return true;
    }

    return false;
  } catch (error: any) {
    logger.error("Error blacklisting User", {
      error: (error as Error).message,
    });
    return true;
  }
};
