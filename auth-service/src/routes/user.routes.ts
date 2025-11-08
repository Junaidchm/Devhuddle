import { Router } from "express";
import { UserController } from "../controllers/implimentation/user.controller";
import { UserService } from "../services/impliments/user.service";
import { UserRepository } from "../repositories/impliments/user.repository";
import { FollowsRepository } from "../repositories/impliments/follows.repository";
import { FollowsService } from "../services/impliments/follows.service";

const router = Router();

const userRepository = new UserRepository();
const followsRepository = new FollowsRepository();
const followsService = new FollowsService(followsRepository);
const userService = new UserService(userRepository, followsService);
const userController = new UserController(userService);

// User search route (must come before /:username route to avoid conflict)
router.get(
  "/search",
  userController.searchUsers.bind(userController)
);

// Profile routes
router.get(
  "/:username",
  userController.getProfileByUsername.bind(userController)
);
router.get(
  "/:username/followers",
  userController.getFollowers.bind(userController)
);
router.get(
  "/:username/following",
  userController.getFollowing.bind(userController)
);

export default router;

