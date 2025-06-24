import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import logger from "../utils/logger.util";
import multer from 'multer';
import jwtMiddleware from "../middleware/jwt.middleware";

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 1024 * 1024 }, // 1MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, or GIF allowed.'));
    }
  },
});

const router = Router();
const authController: AuthController = new AuthController();

router
  .post("/signup", (req, res, next) => {
    authController.register(req, res, next);
  })
  .post("/verify-otp", authController.verifyOTP.bind(authController))
  .post("/resend", authController.resendOTP.bind(authController))
  .get("/me", authController.getCurrentUser.bind(authController))
  .post("/login", authController.login.bind(authController))

  // User authentication 
  .get('/google', authController.googleAuth.bind(authController))
  .get('/google/callback',authController.googleCallback.bind(authController))

  // Password reset 
  .post('/password-reset' , authController.requestPasswordReset.bind(authController))
  .post('/password-reset/confirm',  authController.resetPassword.bind(authController))

  // Profile update
  .patch('/profile', jwtMiddleware, upload.single('profilePicture'), authController.updateProfile.bind(authController))
  .get('/profile', jwtMiddleware, authController.getProfile.bind(authController));



export default router;
