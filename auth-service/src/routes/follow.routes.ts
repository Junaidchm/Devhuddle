
import { Router } from "express";
import { FollowsRepository } from "../repositories/impliments/follows.repository";
import { FollowsService } from "../services/impliments/follows.service";
import { FollowsController } from "../controllers/implimentation/follow.controller";


const followsRepository = new FollowsRepository();
const followsService = new FollowsService(followsRepository);
const followsController = new FollowsController(followsService);

const router = Router();

router
 .get("/suggestions", followsController.getSuggestions.bind(followsController))
 .post("/follow", followsController.follow.bind(followsController))
 .post("/unfollow", followsController.unfollow.bind(followsController))
 
export default router;
