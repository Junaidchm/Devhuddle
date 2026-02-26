import { Response } from "express";
import { generateAccessToken, GenerateRefreshToken } from "./jwt.util";
import { jwtUserFilter } from "../types/auth";
import { generateUuid4 } from "./uuid.util";

/**
 * Cookie configuration
 *
 * IMPORTANT: Do NOT set `domain` for localhost — it breaks cookie delivery in some browsers.
 * For production, set COOKIE_DOMAIN env var (e.g. "yourdomain.com").
 *
 * sameSite:
 *   - "lax"  → safe for same-site requests (good for localhost dev)
 *   - "none" → required for cross-origin requests (MUST also set secure: true)
 *
 * secure:
 *   - false for HTTP (localhost dev)
 *   - true for HTTPS (production, required when sameSite: "none")
 */
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // undefined = current hostname
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const COOKIE_SAME_SITE: "lax" | "none" = IS_PRODUCTION ? "none" : "lax";
const COOKIE_SECURE = IS_PRODUCTION;

const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;            // 15 minutes
const REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Set both access and refresh token cookies.
 * Called after login, OAuth callback, and token refresh (full rotation).
 */
export const setCookies = (
  accessToken: string,
  refreshToken: string,
  res: Response
): void => {
  // Clear existing cookies first to avoid stale token accumulation
  clearCookies(res);

  res.cookie("access_token", accessToken, {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS * 1000,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
  });

  res.cookie("refresh_token", refreshToken, {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS * 1000,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
  });
};

/**
 * Generate and set a new access token cookie only (no refresh rotation).
 */
export const setAccesToken = async (
  res: Response,
  user: jwtUserFilter,
  jti: string
): Promise<string> => {
  const accessToken = generateAccessToken(user, jti);

  res.cookie("access_token", accessToken, {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS * 1000,
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
  });

  return accessToken;
};

/**
 * Generate both tokens, set cookies, and return the raw token strings.
 * Called on login, OAuth callback, and full token rotation (refresh).
 */
export const setAuthToken = async (
  userData: jwtUserFilter,
  res: Response
): Promise<{ accessToken: string; refreshToken: string }> => {
  const accessToken = generateAccessToken(userData, generateUuid4());
  const refreshToken = GenerateRefreshToken(userData, generateUuid4());
  setCookies(accessToken, refreshToken, res);
  return { accessToken, refreshToken };
};

/**
 * Clear all auth cookies.
 * Called on logout.
 */
export const clearCookies = (res: Response): void => {
  const clearOptions = {
    domain: COOKIE_DOMAIN,
    httpOnly: true,
    path: "/",
    sameSite: COOKIE_SAME_SITE,
    secure: COOKIE_SECURE,
    maxAge: 0,
  };

  res.clearCookie("access_token", clearOptions);
  res.clearCookie("refresh_token", clearOptions);
};
