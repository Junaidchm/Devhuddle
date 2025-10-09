// import compression from "compression";
// import cookieParser from "cookie-parser";
// import { json, Router, urlencoded } from "express";
// import jwtMiddleware from "../middleware/jwt.middleware";
// import { FollowsRepository } from "../repositories/impliments/follows.repository";
// import { FollowsService } from "../services/impliments/follows.service";
// import { FollowsController } from "../controllers/implimentation/follow.controller";

// const followsRepository = new FollowsRepository();
// const followsService = new FollowsService(followsRepository);
// const followsController = new FollowsController(followsService);

// const router = Router();

// // router.get("/suggestions", jwtMiddleware, (req, res, next) => {
// // 	followsController.getSuggestions(req, res).catch(next);
// // });

// router
//     .get("/suggestions", followsController.getSuggestions.bind(followsController))

// export default router;


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
export default router;
