import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import logger from '../utils/logger.util';

/**
 * Validation middleware factory - validates request body against DTO
 */
export function validateDto(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Transform plain object to DTO instance
      const dtoInstance = plainToInstance(dtoClass, req.body);

      // Validate the DTO
      const errors = await validate(dtoInstance);

      if (errors.length > 0) {
        // Format validation errors
        const formattedErrors = errors.map(error => ({
          field: error.property,
          constraints: error.constraints
        }));

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: formattedErrors
        });
        return;
      }

      // Attach validated DTO to request
      req.body = dtoInstance;
      next();
    } catch (error) {
      logger.error('DTO validation error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        message: 'Validation failed'
      });
    }
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQuery(dtoClass: any) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Transform query params to DTO instance with type conversion enabled
      const dtoInstance = plainToInstance(dtoClass, req.query as object, {
        enableImplicitConversion: true  // Enable automatic type conversion
      });

      // Validate the DTO
      const errors = await validate(dtoInstance as object);

      if (errors.length > 0) {
        const formattedErrors = errors.map(error => ({
          field: error.property,
          constraints: error.constraints
        }));

        res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: formattedErrors
        });
        return;
      }

      // Attach validated and transformed DTO to request
      // Attach validated and transformed DTO to request
      // Note: req.query is read-only in some Express environments, so we attach to a custom property
      // or modify properties individually if needed. For now, we'll keep the DTO available.
      (req as any).validatedQuery = dtoInstance;
      
      // Also try to update query properties individually for backward compatibility if possible,
      // but catch errors if it fails (it's read-only)
      try {
        Object.assign(req.query, dtoInstance);
      } catch (e) {
        // Ignore assignment errors for read-only query
      }
      next();
    } catch (error) {
      logger.error('Query validation error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        message: 'Validation failed'
      });
    }
  };
}
