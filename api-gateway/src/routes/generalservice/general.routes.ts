import {Router, urlencoded,json} from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import jwtMiddleware from "../../middleware/jwt.middleware";
import { generatePresignedUrl } from "../../utils/generate.presigned.url";

const router = Router()

router.use(compression());
router.use(json());
router.use(urlencoded({extended:true}));
router.use(cookieParser())

router
    .post('/generate-presigned-url',jwtMiddleware,generatePresignedUrl)

export default router; 
    
