import {Router, urlencoded,json,Request,Response} from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import jwtMiddleware from "../../middleware/jwt.middleware";
import { createPost, deletePost, deleteUnuseMedias, listPost, submitPost, uploadMedia } from "../../controllers/feed/main.feed";
import { validate } from "../../middleware/validateResource";
import { PostSchema } from "../../dto/feed.dto";

const router = Router()

router.use(compression());
router.use(json());
router.use(urlencoded({extended:true}));
router.use(cookieParser())

router
    .post('/post',jwtMiddleware,submitPost)
    .post('/submit',jwtMiddleware,createPost)
    .get('/list',jwtMiddleware,listPost)
    .post('/media',uploadMedia)

    // deleting the post
    .delete('/delete',jwtMiddleware,deletePost)
    .delete('/medias',deleteUnuseMedias)

export default router; 
    
