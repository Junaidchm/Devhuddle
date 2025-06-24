export interface SignupRequest {
  email: string;
  password: string;
}

export interface SignupResponse {
  userId: string;
  token: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

export interface OtpRequest {
  email: string;
  otp: string;
}

export interface OtpResponse {
  success: boolean;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface ResetPasswordResponse {
  success: boolean;
}

export interface ApiError {
  status: number;
  message: string;
}

export interface User {
  id: string;
  email: string;
  role?: string;
}