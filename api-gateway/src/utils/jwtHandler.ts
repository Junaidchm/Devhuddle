import { Response } from "express";
import { generateAccessToken, GenerateRefreshToken } from "./jwt.util";
import { jwtPayload, jwtUserFilter } from "../types/auth";
import { generateUuid4 } from "./uuid.util";

const generateAccessTTL = (minute: number): Date => {
  return new Date(new Date().getTime() + minute * 60 * 1000);
};

const generateRefresTTL = (days: number): Date => {
  return new Date(new Date().getTime() + days * 24 * 60 * 60 * 1000);
};

export const setCookies = (
  accessToken: string,
  refreshToken: string,
  res: Response
) => {
  res.clearCookie("access_token", {
    domain: "localhost",
    httpOnly: true,
    path: "/",
  });

  res.clearCookie("refresh_token", {
    domain: "localhost",
    httpOnly: true,
    path: "/",
  });
  const expiryAccessToken = generateAccessTTL(15);
  const expiryRefreshToken = generateRefresTTL(7);

  res.cookie("access_token", accessToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryAccessToken,
    sameSite: "lax",
    // httpOnly: true,
    // path: "/",
    // expires: expiryAccessToken,
    // sameSite: "none", // allow cross-origin
    // secure: true,
  });

  res.cookie("refresh_token", refreshToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryRefreshToken,
    sameSite: "lax",
    // httpOnly: true,
    // path: "/",
    // expires: expiryRefreshToken,
    // sameSite: "none", // allow cross-origin
    // secure: true,
  });

  return;
};

export const setAccesToken = async (
  res: Response,
  user: jwtUserFilter,
  jti: string
) => {
  const expiryAccessToken = generateAccessTTL(15);
  const accessToken = generateAccessToken(user, jti);
  res.cookie("access_token", accessToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryAccessToken,
    sameSite: "lax",
    // httpOnly: true,
    // path: "/",
    // expires: expiryAccessToken,
    // sameSite: "none",
    // secure: true,
  });

  return accessToken
};

export const setAuthToken = async (userData: jwtUserFilter, res: Response) => {
  try {
    console.log("this is the jwt payload:", userData);
    const accessToken = generateAccessToken(userData, generateUuid4());
    const refreshToken = GenerateRefreshToken(userData, generateUuid4());
    setCookies(accessToken, refreshToken, res);
    return {accessToken,refreshToken}
  } catch (error) {
    console.log("Error while setting auth tokens");
    throw error;
  } 
};

export const clearCookies = (res: Response): void => {
  try {
    res.clearCookie("access_token", {
      domain: "localhost",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });

    res.clearCookie("refresh_token", {
      domain: "localhost",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
  } catch (error) {
    console.log("error  while clearing cookie");
    throw error;
  }
};
