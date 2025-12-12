import { Router } from "express";
import { AuthController } from "../controllers/implimentation/auth.controller";
import { validateDto } from "../middleware/validation.middleware";
import { 
  RegisterDto, 
  LoginDto, 
  VerifyOtpDto, 
  ResendOtpDto, 
  RequestPasswordResetDto, 
  ResetPasswordDto, 
  UpdateProfileDto, 
  RefreshTokenDto, 
  GeneratePresignedUrlDto 
} from "../dtos/auth.dto";
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
  .post("/signup", validateDto(RegisterDto), authController.signupHttp.bind(authController))
  
  // Verify OTP
  .post("/verify-otp", validateDto(VerifyOtpDto), authController.verifyOtpHttp.bind(authController))
  
  // Resend OTP
  .post("/resend", validateDto(ResendOtpDto), authController.resendOtpHttp.bind(authController))
  
  // Get current user (me) - userId comes from x-user-data header (API Gateway)
  .get("/me", authController.getMeHttp.bind(authController))
  
  // Login
  .post("/login", validateDto(LoginDto), authController.loginHttp.bind(authController))
  
  // Logout - userId comes from x-user-data header (API Gateway)
  .post("/logout", authController.logoutHttp.bind(authController))
  
  // Request password reset
  .post("/password-reset", validateDto(RequestPasswordResetDto), authController.requestPasswordResetHttp.bind(authController))
  
  // Confirm password reset
  .post("/password-reset/confirm", validateDto(ResetPasswordDto), authController.confirmPasswordResetHttp.bind(authController))
  
  // Get profile - userId comes from x-user-data header (API Gateway)
  .get("/profile", authController.getProfileHttp.bind(authController))
  
  // Update profile - userId comes from x-user-data header (API Gateway)
  .patch("/profile", validateDto(UpdateProfileDto), authController.updateProfileHttp.bind(authController))
  
  // Refresh token - email comes from x-user-data header (API Gateway)
  .post("/refresh", validateDto(RefreshTokenDto), authController.refreshTokenHttp.bind(authController))
  
  // Generate presigned URL - userId comes from x-user-data header (API Gateway)
  .post("/generate-presigned-url", validateDto(GeneratePresignedUrlDto), authController.generatePresignedUrlHttp.bind(authController));

export default router;
