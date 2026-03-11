import { generateAccessToken, GenerateRefreshToken } from "./jwt.util";
import { jwtUserFilter } from "../types/auth";
import { generateUuid4 } from "./uuid.util";

export const setAccesToken = async (
  user: jwtUserFilter,
  jti: string
) => {
  const accessToken = generateAccessToken(user, jti);
  return { accessToken };
};

export const setAuthToken = async (userData: jwtUserFilter) => {
  try {
    const accessToken = generateAccessToken(userData, generateUuid4());
    const refreshToken = GenerateRefreshToken(userData, generateUuid4());
    return { accessToken, refreshToken }
  } catch (error) {
    console.log("Error while setting auth tokens");
    throw error;
  } 
};
