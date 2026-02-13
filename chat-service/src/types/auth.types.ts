
import { Request } from "express";

/**
 * JWT token payload structure
 */
export interface JWTPayload {
    /** User ID from the token */
    id: string;
    /** Additional JWT claims */
    [key: string]: unknown;
}

/**
 * Express Request with authenticated user
 */
export interface IAuthenticatedRequest extends Request {
    user?: JWTPayload;
}
