import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/error.util';

export function validateDto<T extends object>(dtoClass: new (...args: unknown[]) => T) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const dtoObject = plainToInstance(dtoClass, req.body);
    const errors: ValidationError[] = await validate(dtoObject, { 
      whitelist: true, // strip properties that don't have decorators
      forbidNonWhitelisted: true // throw error if non-whitelisted properties are present
    });

    if (errors.length > 0) {
      const messages = errors.map((error: ValidationError) => {
        return Object.values(error.constraints || {}).join(', ');
      }).join('; ');
      
      const error = new CustomError(400, `Validation failed: ${messages}`);
      return next(error);
    }

    next();
  };
}
