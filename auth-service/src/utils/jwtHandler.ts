import { generateAccessToken, GenerateRefreshToken } from "./jwt.util";
import { jwtUserFilter } from "../types/auth";
import { generateUuid4 } from "./uuid.util";

/**
 * Generates an access token and returns it.
 * (No longer mutates Express Response cookies)
 */
export const setAccesToken = async (
  user: jwtUserFilter,
  jti: string
) => {
  const accessToken = generateAccessToken(user, jti);
  return { accessToken };
};

/**
 * Generates both access and refresh tokens and returns them.
 * (No longer mutates Express Response cookies)
 */
export const setAuthToken = async (userData: jwtUserFilter) => {
  try {
    const accessToken = generateAccessToken(userData, generateUuid4());
    const refreshToken = GenerateRefreshToken(userData, generateUuid4());
    return { accessToken, refreshToken };
  } catch (error) {
    console.log("Error while setting auth tokens");
    throw error;
  }
};
