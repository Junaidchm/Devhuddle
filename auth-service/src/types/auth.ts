export interface User {
    id: string;
    email: string;
    username: string;
    role: string;
    profilePicture: string | null;
    name: string;
    password: string;
    location: string | null;
    bio: string | null;
    skills: string[];
    yearsOfExperience: string | null;
    jobTitle: string | null;
    company: string | null;
    emailVerified: boolean;
    isBlocked: boolean;
    createdAt: Date;
    updatedAt: Date;
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
  profilePicture?: string
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
  name: string;
}

export interface jwtPayload {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  jti:string
}

export interface jwtUserFilter {
  id: string;
  email?: string;
  username?: string;
  role?: string;
  name?:string;
  emailVerified?:boolean
  profilePicture?:string | null
}


export interface ApiError {
  status: number;
  message: string;
  success?: boolean;
}


export interface SuggestedUser {
  id: string;
  username: string;
  name: string;
  profilePicture: string | null;
  _count: {
    followers: number;
  };
}
