// import { Request, Response, NextFunction } from 'express';
// import { HttpStatus } from '../utils/constents';
// import { sendErrorResponse } from '../utils/error.util';
// import { ApiError } from '../types/auth';

// export const requireRole = (requiredRole: string) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     if (!req.user || req.user.role !== requiredRole) {
//       return sendErrorResponse(res, {
//         status: HttpStatus.FORBIDDEN,
//         message: 'Insufficient permissions',
//       });
//     }
//     next();
//   };
// };