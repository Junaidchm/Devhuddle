import { Router, json, urlencoded } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";

const commonMiddleware = Router();

commonMiddleware.use(compression());
commonMiddleware.use(json());
commonMiddleware.use(urlencoded({ extended: true }));
commonMiddleware.use(cookieParser());

export default commonMiddleware;
