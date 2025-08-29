import { Router, urlencoded, json } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import jwtMiddleware from "../../middleware/jwt.middleware";
import { generatePresignedUrl, submitPost } from "../../controller/feed/main.feed";
import { validate } from "../../middleware/validateResource";
import { PostSchema } from "../../dto/feed.dto";

const router = Router();

router.use(compression());
router.use(json());
router.use(urlencoded({ extended: true }));
router.use(cookieParser());

router
  .post("/post",jwtMiddleware, validate(PostSchema), submitPost)
  .post("/generate-presigned-url",jwtMiddleware,generatePresignedUrl);

export default router;
