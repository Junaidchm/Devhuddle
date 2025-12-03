import { Router } from "express";
import { AuthController } from "../controllers/implimentation/auth.controller";
import { AuthService } from "../services/impliments/auth.service";
import { UserRepository } from "../repositories/impliments/user.repository";

const router = Router();

const userRepository: UserRepository = new UserRepository();
const authService: AuthService = new AuthService(userRepository);
const authController: AuthController = new AuthController(authService);

// HTTP route handlers - clean routes using bind()
// Note: Authentication is handled by API Gateway, so no jwtMiddleware needed here
router
  // User authentication
  .get("/google", authController.googleAuth.bind(authController))
  .get("/google/callback", authController.googleCallback.bind(authController))

  // Signup
  .post("/signup", authController.signupHttp.bind(authController))
  
  // Verify OTP
  .post("/verify-otp", authController.verifyOtpHttp.bind(authController))
  
  // Resend OTP
  .post("/resend", authController.resendOtpHttp.bind(authController))
  
  // Get current user (me) - userId comes from x-user-data header (API Gateway)
  .get("/me", authController.getMeHttp.bind(authController))
  
  // Login
  .post("/login", authController.loginHttp.bind(authController))
  
  // Logout - userId comes from x-user-data header (API Gateway)
  .post("/logout", authController.logoutHttp.bind(authController))
  
  // Request password reset
  .post("/password-reset", authController.requestPasswordResetHttp.bind(authController))
  
  // Confirm password reset
  .post("/password-reset/confirm", authController.confirmPasswordResetHttp.bind(authController))
  
  // Get profile - userId comes from x-user-data header (API Gateway)
  .get("/profile", authController.getProfileHttp.bind(authController))
  
  // Update profile - userId comes from x-user-data header (API Gateway)
  .patch("/profile", authController.updateProfileHttp.bind(authController))
  
  // Refresh token - email comes from x-user-data header (API Gateway)
  .post("/refresh", authController.refreshTokenHttp.bind(authController))
  
  // Generate presigned URL - userId comes from x-user-data header (API Gateway)
  .post("/generate-presigned-url", authController.generatePresignedUrlHttp.bind(authController));

export default router;
