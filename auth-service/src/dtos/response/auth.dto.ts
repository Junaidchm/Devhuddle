/**
 * Response DTO for authentication operations
 * Returned after login or registration
 */
export interface AuthResponseDto {
  user: {
    id: string;
    name: string;
    username: string;
    email: string;
    profilePicture?: string;
  };
  accessToken: string;
  refreshToken: string;
  message?: string;
}

/**
 * Response DTO for token refresh
 */
export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}

/**
 * Response DTO for OTP verification
 */
export interface OtpVerificationResponseDto {
  success: boolean;
  message: string;
  user?: {
    id: string;
    name: string;
    username: string;
    email: string;
  };
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Response DTO for password reset request
 */
export interface PasswordResetRequestResponseDto {
  success: boolean;
  message: string;
}

/**
 * Response DTO for password reset
 */
export interface PasswordResetResponseDto {
  success: boolean;
  message: string;
}
