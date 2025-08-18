import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { ZodTypeAny } from "zod";

export const validate =
  (schema: ZodTypeAny) => (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      console.log('the validation completed')
      next()
    } catch (error: any) {
      logger.error('schema validation failed .........')
      return res.status(400).json(error.message || "Server Error");
    }
  };
