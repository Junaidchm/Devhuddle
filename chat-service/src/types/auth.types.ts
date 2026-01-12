/**
 * Authentication-related type definitions
 * @module types/auth
 */

/**
 * JWT token payload structure
 */
export interface JWTPayload {
    /** User ID from the token */
    id: string;
    /** Additional JWT claims */
    [key: string]: unknown;
}
