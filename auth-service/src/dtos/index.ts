// Re-export all request DTOs
export { RegisterDto } from './request/register.dto';
export { LoginDto } from './request/login.dto';
export { VerifyOtpDto } from './request/verify-otp.dto';
export { ResendOtpDto } from './request/resend-otp.dto';
export { RequestPasswordResetDto } from './request/request-password-reset.dto';
export { ResetPasswordDto } from './request/reset-password.dto';
export { UpdateProfileDto } from './request/update-profile.dto';
export { RefreshTokenDto } from './request/refresh-token.dto';
export { GeneratePresignedUrlDto } from './request/generate-presigned-url.dto';
export { GetChatSuggestionsQueryDto } from './request/get-chat-suggestions.dto';

// Re-export all response DTOs
export { UserResponseDto } from './response/user.dto';
export { 
  AuthResponseDto, 
  RefreshTokenResponseDto, 
  OtpVerificationResponseDto,
  PasswordResetRequestResponseDto,
  PasswordResetResponseDto 
} from './response/auth.dto';
export { ChatSuggestionDto, ChatSuggestionsResponseDto } from './response/chat-suggestion.dto';
export { PresignedUrlResponseDto } from './response/presigned-url.dto';
