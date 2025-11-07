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

  .get("/search",authController.searchUsers.bind(authController))

export default router;
