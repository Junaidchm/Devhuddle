import { Request, Response } from "express";
import {
  GeneratePresignedUrlRequest,
  GeneratePresignedUrlResponse,
  PostServiceClient,
} from "../../grpc/generated/post";
import { grpcCall, grpcs } from "../../utils/grpc.helper";
import { CreatePostRequest } from "../../grpc/generated/post";
import { postClient } from "../../config/grpc.client";
import { grpcToHttp } from "../../constants/http.status";
import { HttpStatus } from "../../utils/constents";
import { filterError, sendErrorResponse } from "../../utils/error.util";
import { logger } from "../../utils/logger";
import { JwtPayload } from "../../grpc/generated/auth";
import { FeedMapper } from "../../mapper/feed.mapper";

export const submitPost = async (req: Request, res: Response) => {
  const request = req.body;
  const response = await grpcs<PostServiceClient, CreatePostRequest, void>(
    postClient,
    "createPost",
    request
  );
};

export const generatePresignedUrl = async (req: Request, res: Response) => {
  try {
    const decoded = req.user as JwtPayload;

    const request = FeedMapper.generatePresigneUrlRequest(
      req.body,
      decoded.id
    ) as GeneratePresignedUrlRequest;

    const response = await grpcs<
     PostServiceClient,GeneratePresignedUrlRequest,GeneratePresignedUrlResponse
    >(
      postClient,
      "generatePresignedUrl",
      request
    );
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
    const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
    sendErrorResponse(res, {
      status: statusCode,
      message: filterError(err) || "Server error",
    });
  }
};
