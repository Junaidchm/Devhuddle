import { Router, Request, Response, NextFunction } from "express";
import { AuthController } from "../controllers/auth.controller";
import logger from "../utils/logger.util";
import multer from "multer";
import jwtMiddleware from "../middleware/jwt.middleware";
import refreshTokenMiddleware from "../middleware/refreshToken";
import { requireRole } from "../middleware/role.middleware";
import { AuthService } from "../services/auth.service";
import { UserRepository } from "../repositories/user.repository";

const router = Router();

const userRepository:UserRepository = new UserRepository()
const authService:AuthService = new AuthService(userRepository)
const authController: AuthController = new AuthController(authService);

router
  .post("/verify-otp", authController.verifyOTP.bind(authController))
  .post("/resend", authController.resendOTP.bind(authController))
  .get("/me", jwtMiddleware, authController.getCurrentUser.bind(authController))
  .post("/login", authController.login.bind(authController))
  .post(
    "/logout",
    jwtMiddleware,
    authController.logoutUser.bind(authController)
  )

  // User authentication
  .get("/google", authController.googleAuth.bind(authController))
  .get("/google/callback", authController.googleCallback.bind(authController))

  // Password reset
  .post(
    "/password-reset",
    authController.requestPasswordReset.bind(authController)
  )
  .post(
    "/password-reset/confirm",
    authController.resetPassword.bind(authController)
  )

  // Profile update
  .patch(
    "/profile",
    jwtMiddleware,
    // upload.single("profilePicture"),
    authController.updateProfile.bind(authController)
  )
  .get(
    "/profile",
    jwtMiddleware,
    authController.getProfile.bind(authController)
  )

  .post(
    '/generate-presigned-url',
    jwtMiddleware,
    authController.generatePresignedUrl.bind(authController)
  )

  // verify refresh token
  .get(
    "/refresh",
    refreshTokenMiddleware,
    authController.verifyRefreshToken.bind(authController)
  )


export default router;
