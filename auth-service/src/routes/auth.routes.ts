import { Router, Request, Response, NextFunction } from "express";
import { AuthController } from "../controllers/implimentation/auth.controller";

import { AuthService } from "../services/impliments/auth.service";
import { UserRepository } from "../repositories/impliments/user.repository";

const router = Router();

const userRepository: UserRepository = new UserRepository();
const authService: AuthService = new AuthService(userRepository);
const authController: AuthController = new AuthController(authService);

router

  // User authentication
  .get("/google", authController.googleAuth.bind(authController))
  .get("/google/callback", authController.googleCallback.bind(authController))

  // Note: searchUsers has been moved to user.routes.ts at /users/search
  // Keeping this route for backward compatibility, but /users/search is the preferred route

export default router;
