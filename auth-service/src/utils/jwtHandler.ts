import { Response } from "express";
// import { encryptData } from "../encription";
import { User } from "../generated/prisma";
import {
  generateAccessToken,
  GenerateRefreshToken,
  // saveRefreshToken,
} from "./jwt.util";
import { jwtAccessToken } from "../types/auth";

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
  const expiryAccessToken = new Date(new Date().getTime() + 60 * 60 * 1000);
  const expiryRefreshToken = new Date(
    new Date().getTime() + 7 * 24 * 60 * 60 * 1000
  );

  res.cookie("access_token", accessToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryAccessToken,
    sameSite: "lax",
  });

  res.cookie("refresh_token", refreshToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryRefreshToken,
    sameSite: "lax",
  });

  return;
};

export const setAccesToken = async (res: Response, payload: User) => {
  const expiryAccessToken = new Date(new Date().getTime() + 60 * 60 * 1000);
  const accessToken = generateAccessToken(payload);
  res.cookie("access_token", accessToken, {
    domain: "localhost",
    httpOnly: true,
    path: "/",
    expires: expiryAccessToken,
    sameSite: "lax",
  });
};

export const setAuthToken = async (user: User, res: Response) => {
  try {
    const accessToken = generateAccessToken(user);
    const refreshToken = GenerateRefreshToken(user);
    setCookies(accessToken, refreshToken, res);
  } catch (error) {
    console.log("Error while setting auth tokens");
    throw error;
  }
};
