import { Request, Response } from "express";
import {
  AuthServiceClient,
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
  GetJwtUserRequest,
  GetJwtUserResponse,
  GetProfileRequest,
  GetProfileResponse,
  JwtPayload,
  LogingRequest,
  LogingResponse,
  PasswordResetConfirmRequest,
  PasswordResetRequest,
  PasswordResetResponse,
  RegisterRequest,
  RegisterResponse,
  ResentOTPRequest,
  ResentOTPResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
  VerifyOTPRequest,
  VerifyOTPResponse,
  VerifyRefreshTokenRequest,
  VerifyRefreshTokenResponse,
} from "../grpc/generated/auth";
import { HttpStatus } from "../utils/constents";
import { filterError, sendErrorResponse } from "../utils/error.util";
import { grpcCall, grpcs } from "../utils/grpc.helper";
import { logger } from "../utils/logger";
import { grpcToHttp } from "../constants/http.status";
import {
  clearCookies,
  setAccesToken,
  setAuthToken,
} from "../utils/jwtHandler";
import { setJtiAsBlackListed } from "../utils/redis.actions";
import { Messages } from "../constants/reqresMessages";
import { generateUuid4 } from "../utils/uuid.util";
import { createGrpcBreaker } from "../utils/grpcResilience.util";
import { authClient } from "../config/grpc.client";

export const signup = async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/signup request", { body: req.body });
    const { name, email, password, username } = req.body as RegisterRequest;
    const request: RegisterRequest = { name, email, password, username };
    const response: RegisterResponse = await grpcCall("register", request);
    res.status(HttpStatus.CREATED).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/signup", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const verifyOtp = async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/verify-otp request", { body: req.body });
    const { email, otp } = req.body as VerifyOTPRequest;
    const request: VerifyOTPRequest = { email, otp };
    const response: VerifyOTPResponse = await grpcCall("verifyOtp", request);
    if (response.jwtpayload) {
      await setAuthToken(response.jwtpayload, res);
    }
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/verify-otp", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const resendOtp = async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/resend-otp request", { body: req.body });
    const request = { email: req.body.email };
    const response: ResentOTPResponse = await grpcCall<
      ResentOTPRequest,
      ResentOTPResponse
    >("resendOtp", request);
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/resend-otp", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/me request", { body: req.body });
    const request = { userId: req.user?.id! };
    const response = await grpcCall<GetJwtUserRequest, GetJwtUserResponse>(
      "getJwtUser",
      request
    );
    res.status(HttpStatus.OK).json(response);
  } catch (err: any) {
    logger.error("Error in /auth/me : getting user", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    console.log("Received /auth/login request", { body: req.body });
    const { email, password } = req.body as LogingRequest;
    const request: LogingRequest = { email, password };
    const loginWithBreaker = createGrpcBreaker("login", (request) =>
      grpcCall("login", request)
    );
    const response = (await loginWithBreaker(request)) as LogingResponse;
    if (response) {
      await setAuthToken(response.jwtpayload!, res);
    }
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const logout = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/logout request");
    setJtiAsBlackListed(req.cookies);
    clearCookies(res);
    res
      .status(HttpStatus.OK)
      .json({ success: true, message: Messages.LOGOUT_SUCCESS });
  } catch (err: any) {
    logger.error("Error in /auth/logout", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const requestPasswordReset = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/password-reset request", { body: req.body });
    const request: PasswordResetRequest = { email: req.body.email };
    const response = await grpcCall<
      PasswordResetRequest,
      PasswordResetResponse
    >("requestPasswordReset", request);
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/request-password-reset", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const confirmPasswordReset = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/password-reset/confirm", { body: req.body });
    const { token, newPassword } = req.body;
    const request: PasswordResetConfirmRequest = { token, newPassword };
    const response = await grpcCall<
      PasswordResetConfirmRequest,
      PasswordResetResponse
    >("resetPassword", request);
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/password-reset/confirm", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const getProfile = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/profile request");
    const decoded = req.user as JwtPayload;
    const request: GetProfileRequest = { userId: decoded.id };
    const response = await grpcCall<GetProfileRequest, GetProfileResponse>(
      "getProfile",
      request
    );
    res.status(HttpStatus.OK).json(response);
  } catch (err: any) {
    logger.error("Error in /auth/profile", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const updateProfile = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/profile request", { body: req.body });
    const { id: userId } = req.user as JwtPayload;
    const { name, username, location, bio, profilePicture } = req.body;
    const request: UpdateProfileRequest = {
      userId,
      name,
      username,
      location,
      bio,
      profilePicture,
    };
    const response = await grpcCall<
      UpdateProfileRequest,
      UpdateProfileResponse
    >("updateProfile", request);
    res.status(HttpStatus.OK).json(response);
  } catch (err: any) {
    logger.error("Error in /auth/profile", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const refreshToken = async (req: Request, res: Response) => {
  try {
    logger.info("Received /auth/verify-refresh-token request");
    const decoded = req.user as JwtPayload;
    const request: VerifyRefreshTokenRequest = { email: decoded.email };
    const response = await grpcCall<
      VerifyRefreshTokenRequest,
      VerifyRefreshTokenResponse
    >("verifyRefreshToken", request);
    if (response.jwtpayload) {
      await setAccesToken(res, response.jwtpayload, generateUuid4());
    }
    res.status(HttpStatus.OK).json({ message: response.message });
  } catch (err: any) {
    logger.error("Error in /auth/verify-refresh-token", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};

export const generatePresignedUrl = async (req: Request, res: Response) => {
  try {
    // logger.info("Received /auth/generate-presigned-url request", {
    //   body: req.body,
    // });
    const decoded = req.user as JwtPayload;
    const { operation, fileName, fileType, key } =
      req.body as GeneratePresignedUrlRequest;
    const request: GeneratePresignedUrlRequest = {
      userId: decoded.id,
      operation,
      fileName,
      fileType,
      key,
    };
    const response = await grpcs<
      AuthServiceClient,
      GeneratePresignedUrlRequest,
      GeneratePresignedUrlResponse
    >(authClient,"generatePresignedUrl", request);
    res.status(HttpStatus.OK).json({
      url: response.url,
      key: response.key,
      expiresAt: response.expiresAt,
    });
  } catch (err: any) {
    logger.error("Error in /auth/generate-presigned-url", { error: err.message });
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};


// import { Request, Response } from "express";
// import {
//   GeneratePresignedUrlRequest,
//   GeneratePresignedUrlResponse,
//   GetJwtUserRequest,
//   GetJwtUserResponse,
//   GetProfileRequest,
//   GetProfileResponse,
//   JwtPayload,
//   LogingRequest,
//   LogingResponse,
//   PasswordResetConfirmRequest,
//   PasswordResetRequest,
//   PasswordResetResponse,
//   RegisterRequest,
//   RegisterResponse,
//   ResentOTPRequest,
//   ResentOTPResponse,
//   UpdateProfileRequest,
//   UpdateProfileResponse,
//   VerifyOTPRequest,
//   VerifyOTPResponse,
//   VerifyRefreshTokenRequest,
//   VerifyRefreshTokenResponse,
// } from "../grpc/generated/auth";
// import { HttpStatus } from "../utils/constents";
// import { grpcCall } from "../utils/grpc.helper";
// import {
//   clearCookies,
//   setAccesToken,
//   setAuthToken,
// } from "../utils/jwtHandler";
// import { setJtiAsBlackListed } from "../utils/redis.actions";
// import { Messages } from "../constants/reqresMessages";
// import { generateUuid4 } from "../utils/uuid.util";
// import { createGrpcBreaker } from "../utils/grpcResilience.util";
// import { handleGrpcCall } from "../utils/grpcControllerHandler";

// // signup
// export const signup = async (req: Request, res: Response) => {
//   const request: RegisterRequest = req.body;
//   await handleGrpcCall<RegisterRequest, RegisterResponse>(
//     res,
//     "signup",
//     () => grpcCall("register", request),
//     (response) => ({ message: response.message })
//   );
// };

// // verifyOtp
// export const verifyOtp = async (req: Request, res: Response) => {
//   const request: VerifyOTPRequest = req.body;
//   await handleGrpcCall<VerifyOTPRequest, VerifyOTPResponse>(
//     res,
//     "verifyOtp",
//     () => grpcCall("verifyOtp", request),
//     async (response) => {
//       if (response.jwtpayload) {
//         await setAuthToken(response.jwtpayload, res);
//       }
//       return { message: response.message };
//     }
//   );
// };

// // resendOtp
// export const resendOtp = async (req: Request, res: Response) => {
//   const request: ResentOTPRequest = { email: req.body.email };
//   await handleGrpcCall<ResentOTPRequest, ResentOTPResponse>(
//     res,
//     "resendOtp",
//     () => grpcCall("resendOtp", request),
//     (response) => ({ message: response.message })
//   );
// };

// // getMe
// export const getMe = async (req: Request, res: Response) => {
//   const request: GetJwtUserRequest = { userId: req.user?.id! };
//   await handleGrpcCall<GetJwtUserRequest, GetJwtUserResponse>(
//     res,
//     "getMe",
//     () => grpcCall("getJwtUser", request)
//   );
// };

// // login
// export const login = async (req: Request, res: Response) => {
//   const request: LogingRequest = req.body;
//   const loginWithBreaker = createGrpcBreaker<LogingRequest, LogingResponse>("login", (request) =>
//     grpcCall("login", request)
//   );
//   await handleGrpcCall<LogingRequest, LogingResponse>(
//     res,
//     "login",
//     () => loginWithBreaker(request),
//     async (response) => {
//       if (response.jwtpayload) {
//         await setAuthToken(response.jwtpayload, res);
//       }
//       return { message: response.message };
//     }
//   );
// };

// // logout
// export const logout = async (req: Request, res: Response) => {
//   setJtiAsBlackListed(req.cookies);
//   clearCookies(res);
//   res
//     .status(HttpStatus.OK)
//     .json({ success: true, message: Messages.LOGOUT_SUCCESS });
// };

// // requestPasswordReset
// export const requestPasswordReset = async (req: Request, res: Response) => {
//   const request: PasswordResetRequest = { email: req.body.email };
//   await handleGrpcCall<PasswordResetRequest, PasswordResetResponse>(
//     res,
//     "requestPasswordReset",
//     () => grpcCall("requestPasswordReset", request),
//     (response) => ({ message: response.message })
//   );
// };

// // confirmPasswordReset
// export const confirmPasswordReset = async (req: Request, res: Response) => {
//   const request: PasswordResetConfirmRequest = req.body;
//   await handleGrpcCall<PasswordResetConfirmRequest, PasswordResetResponse>(
//     res,
//     "confirmPasswordReset",
//     () => grpcCall("resetPassword", request),
//     (response) => ({ message: response.message })
//   );
// };

// // getProfile
// export const getProfile = async (req: Request, res: Response) => {
//   const decoded = req.user as JwtPayload;
//   const request: GetProfileRequest = { userId: decoded.id };
//   await handleGrpcCall<GetProfileRequest, GetProfileResponse>(
//     res,
//     "getProfile",
//     () => grpcCall("getProfile", request)
//   );
// };

// // updateProfile
// export const updateProfile = async (req: Request, res: Response) => {
//   const { id: userId } = req.user as JwtPayload;
//   const request: UpdateProfileRequest = { userId, ...req.body };
//   await handleGrpcCall<UpdateProfileRequest, UpdateProfileResponse>(
//     res,
//     "updateProfile",
//     () => grpcCall("updateProfile", request)
//   );
// };

// // refreshToken
// export const refreshToken = async (req: Request, res: Response) => {
//   const decoded = req.user as JwtPayload;
//   const request: VerifyRefreshTokenRequest = { email: decoded.email };
//   await handleGrpcCall<VerifyRefreshTokenRequest, VerifyRefreshTokenResponse>(
//     res,
//     "refreshToken",
//     () => grpcCall("verifyRefreshToken", request),
//     async (response) => {
//       if (response.jwtpayload) {
//         await setAccesToken(res, response.jwtpayload, generateUuid4());
//       }
//       return { message: response.message };
//     }
//   );
// };

// //  generatePresignedUrl
// export const generatePresignedUrl = async (req: Request, res: Response) => {
//   const decoded = req.user as JwtPayload;
//   const request: GeneratePresignedUrlRequest = {
//     userId: decoded.id,
//     ...req.body,
//   };
//   await handleGrpcCall<GeneratePresignedUrlRequest, GeneratePresignedUrlResponse>(
//     res,
//     "generatePresignedUrl",
//     () => grpcCall("generatePresignedUrl", request),
//     (response) => ({
//       url: response.url,
//       key: response.key,
//       expiresAt: response.expiresAt,
//     })
//   );
// };
