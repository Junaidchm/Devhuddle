
import { Router, json, urlencoded } from "express";
import cookieParser from "cookie-parser";
import compression from "compression";
import jwtMiddleware from "../../middleware/jwt.middleware";

import {
  signup,
  verifyOtp,
  resendOtp,
  getMe,
  login,
  logout,
  requestPasswordReset,
  confirmPasswordReset,
  getProfile,
  updateProfile,
  refreshToken,
  generatePresignedUrl,
} from "../../controllers/auth.controller";
import refreshTokenMiddleware from "../../middleware/refreshToken";

const router = Router();
router.use(compression());
router.use(json());
router.use(urlencoded({ extended: true }));
router.use(cookieParser());

router
  .post("/signup", signup)
  .post("/verify-otp", verifyOtp)
  .post("/resend", resendOtp)
  .get("/me", jwtMiddleware, getMe)
  .post("/login", login)
  .post("/logout", jwtMiddleware, logout)
  .post("/password-reset", requestPasswordReset)
  .post("/password-reset/confirm", confirmPasswordReset)
  .get("/profile", jwtMiddleware, getProfile)
  .patch("/profile", jwtMiddleware, updateProfile)
  .post("/refresh", refreshTokenMiddleware, refreshToken)
  .post("/generate-presigned-url", jwtMiddleware, generatePresignedUrl);


export default router;
