export interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  password: string;
  role: string;
  profilePicture?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  yearsOfExperience?: string;
  createdAt: Date;
  updatedAt: Date;
  emailVerified?: boolean;
  jobTitle?: string;
  company?: string;
}

export interface ProfileUpdatePayload {
  name?: string;
  username?: string;
  email?: string;
  location?: string;
  bio?: string;
  skills?: string[];
  yearsOfExperience?: string;
  jobTitle?: string;
  company?: string;
  profilePicture?: Express.Multer.File;
}


export interface Session {
  id: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface RegisterRequest {
  email: string;
  username: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface OAuthUser {
  id: string;
  email: string;
  username: string;
  name?: string;
}

export interface jwtAccessToken {
  id: string;
  email?: string;
  username?: string;
  role?: string;
}

export interface ApiError {
  status: number;
  message: string;
  success?: boolean;
}
