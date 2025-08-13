import {
  Router,
  Request,
  Response,
  NextFunction,
  json,
  urlencoded,
} from "express";
import {
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
} from "grpc/generated/auth";
import { HttpStatus } from "../../utils/constents";
import { filterError, sendErrorResponse } from "../../utils/error.util";
import { grpcCall } from "../../utils/grpc.helper";
import { logger } from "../../utils/logger";
import * as grpc from "@grpc/grpc-js";
import {
  clearCookies,
  setAccesToken,
  setAuthToken,
} from "../../utils/jwtHandler";
import cookieParser from "cookie-parser";
import compression from "compression";
import { grpcToHttp } from "../../constants/http.status";
import jwtMiddleware from "../../middleware/jwt.middleware";
import { setJtiAsBlackListed } from "../../utils/redis.actions";
import { Messages } from "../../constants/reqresMessages";
import { generateUuid4 } from "../../utils/uuid.util";
import refreshTokenMiddleware from "../../middleware/refreshToken";
import { createGrpcBreaker } from "../../utils/grpcResilience.util";

const router = Router();
router.use(compression());
router.use(json());
router.use(urlencoded({ extended: true }));
router.use(cookieParser());

router
  .post("/signup", async (req: Request, res: Response) => {
    try {
      console.log("Received /auth/signup request", { body: req.body });
      const { name, email, password, username } = req.body as RegisterRequest;
      const request: RegisterRequest = {
        name,
        email,
        password,
        username,
      };
  
      const response: RegisterResponse = await grpcCall("register",request);
      res.status(HttpStatus.CREATED).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/signup", {
        error: err.message,
      });
      console.log(grpcToHttp[err.code]);
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/verify-otp", async (req: Request, res: Response) => {
    try {
      console.log("Received /auth/verify-otp request", { body: req.body });
      const { email, otp } = req.body as VerifyOTPRequest;
      const request: VerifyOTPRequest = {
        email,
        otp,
      };
      const response: VerifyOTPResponse = await grpcCall("verifyOtp", request);
      if (response.jwtpayload) {
        console.log("helllo ");
        await setAuthToken(response.jwtpayload, res);
      }
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/verify-otp", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/resend", async (req: Request, res: Response) => {
    try {
      console.log("Received /auth/resend-otp request", { body: req.body });
      const request = {
        email: req.body.email,
      };
      const response: ResentOTPResponse = await grpcCall<
        ResentOTPRequest,
        ResentOTPResponse
      >("resendOtp", request);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/resend-otp", { error: err.message });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .get("/me", jwtMiddleware, async (req: Request, res: Response) => {
    try {
      console.log("Received /auth/me request", { body: req.body });
      const request = {
        userId: req.user?.id!,
      };
      const response = await grpcCall<GetJwtUserRequest, GetJwtUserResponse>(
        "getJwtUser",
        request
      );
      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      logger.error("Error in /auth/me : getting user", { error: err.message });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/login", async (req: Request, res: Response) => {
    try {
      console.log("Received /auth/login request", { body: req.body });
      const { email, password } = req.body as LogingRequest;
      const request: LogingRequest = {
        email,
        password,
      };
      const registerWithBreaker =  createGrpcBreaker("login",(request)=> 
         grpcCall("login", request)
      )
      await registerWithBreaker(request) as LogingResponse ;
      // const response: LogingResponse = await grpcCall<
      //   LogingRequest,
      //   LogingResponse
      // >("login", request);
      const response = await registerWithBreaker(request) as LogingResponse;
      if (response) {
        await setAuthToken(response.jwtpayload!, res);
      }
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/logout", jwtMiddleware, async (req: Request, res: Response) => {
    try {
      logger.info("Received /auth/logout request");
      const decoded = req.user as JwtPayload;

      //set user to blackList
      setJtiAsBlackListed(req.cookies);
      //clear cookies
      clearCookies(res);

      res
        .status(HttpStatus.OK)
        .json({ success: true, message: Messages.LOGOUT_SUCCESS });
    } catch (err: any) {
      logger.error("Error in /auth/logout", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/password-reset", async (req: Request, res: Response) => {
    try {
      logger.info("Received /auth/password-reset request", { body: req.body });
      const request: PasswordResetRequest = {
        email: req.body.email,
      };
      const response = await grpcCall<
        PasswordResetRequest,
        PasswordResetResponse
      >("requestPasswordReset", request);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/request-password-reset", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .post("/password-reset/confirm", async (req: Request, res: Response) => {
    try {
      logger.info("Received /auth/password-reset/confirm", { body: req.body });
      const { token, newPassword } = req.body;
      const request: PasswordResetConfirmRequest = {
        token,
        newPassword,
      };
      const response = await grpcCall<
        PasswordResetConfirmRequest,
        PasswordResetResponse
      >("resetPassword", request);
      res.status(HttpStatus.OK).json({ message: response.message });
    } catch (err: any) {
      logger.error("Error in /auth/password-reset/confirm", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .get("/profile", jwtMiddleware, async (req: Request, res: Response) => {
    try {
      logger.info("Received /auth/profile request");
      const decoded = req.user as JwtPayload;
      const request: GetProfileRequest = {
        userId: decoded.id,
      };
      const response = await grpcCall<GetProfileRequest, GetProfileResponse>(
        "getProfile",
        request
      );
      res.status(HttpStatus.OK).json(response);
    } catch (err: any) {
      logger.error("Error in /auth/profile", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .patch("/profile", jwtMiddleware, async (req: Request, res: Response) => {
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
      logger.error("Error in /auth/profile", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  })
  .get(
    "/refresh",
    refreshTokenMiddleware,
    async (req: Request, res: Response) => {
      try {
        logger.info("Received /auth/verify-refresh-token request", {
          body: req.body,
        });
        const decoded = req.user as JwtPayload;
        const request: VerifyRefreshTokenRequest = {
          email: decoded.email,
        };
        const response = await grpcCall<
          VerifyRefreshTokenRequest,
          VerifyRefreshTokenResponse
        >("verifyRefreshToken", request);
        if (response.jwtpayload) {
          await setAccesToken(res, response.jwtpayload, generateUuid4());
        }
        res.status(HttpStatus.OK).json({ message: response.message });
      } catch (err: any) {
        logger.error("Error in /auth/verify-refresh-token", {
          error: err.message,
          stack: err.stack,
        });
        const statusCode =
          grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
        sendErrorResponse(res, {
          status: statusCode,
          message: filterError(err) || "Server error",
        });
      }
    }
  )
  .post("/generate-presigned-url",jwtMiddleware, async (req: Request, res: Response) => {
    try { 
      console.log('request is comming ..................')
      logger.info("Received /auth/generate-presigned-url request", {
        body: req.body,
      });
      const decoded = req.user as JwtPayload;
      const {userId, operation, fileName, fileType, key } =
        req.body as GeneratePresignedUrlRequest;
        console.log('user id checking ...............',userId)
      const request: GeneratePresignedUrlRequest = {
        userId:decoded.id,
        operation,
        fileName,
        fileType,
        key,
      };
      const response = await grpcCall<
        GeneratePresignedUrlRequest,
        GeneratePresignedUrlResponse
      >("generatePresignedUrl", request);
      res.status(HttpStatus.OK).json({
        url: response.url,
        key: response.key,
        expiresAt: response.expiresAt,
      });
    } catch (err: any) {
      logger.error("Error in /auth/generate-presigned-url", {
        error: err.message,
        stack: err.stack,
      });
      const statusCode =
        grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
      sendErrorResponse(res, {
        status: statusCode,
        message: filterError(err) || "Server error",
      });
    }
  });

export default router;
