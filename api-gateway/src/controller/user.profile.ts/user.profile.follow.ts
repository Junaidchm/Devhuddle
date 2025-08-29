import { Request, Response } from "express";
import {
  AuthServiceClient,
  ListFollowersRequest,
  ListFollowersResponse,
} from "../../grpc/generated/auth";
import { grpcCall, grpcs } from "../../utils/grpc.helper";
import { HttpStatus } from "../../utils/constents";
import { logger } from "../../utils/logger";
import { grpcToHttp } from "../../constants/http.status";
import { filterError, sendErrorResponse } from "../../utils/error.util";
import { authClient } from "../../config/grpc.client";

export const ListFollowers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    console.log(
      "request is actually comming here ................. fro profile by user name "
    );
    const { page, pageSize, userName } = req.body;
    const request: ListFollowersRequest = {
      page,
      pageSize,
      userName,
    };

    console.log(
      "this is the requesting data , : ...................................",
      request
    );
    const response = await grpcs<
      AuthServiceClient,
      ListFollowersRequest,
      ListFollowersResponse
    >(authClient, "listFollowers", request);
  } catch (err: any) {
    logger.error("Error in /auth/profile/", {
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
