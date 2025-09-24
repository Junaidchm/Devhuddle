import { Request, Response } from "express";
import {
  CreatePostResponse,
  DeletePostRequest,
  DeletePostResponse,
  DeleteUnusedMediasRequest,
  DeleteUnusedMediasResponse,
  ListPostsRequest,
  ListPostsResponse,
  PostServiceClient,
  SubmitPostRequest,
  SubmitPostResponse,
  UploadMediaRequest,
  UploadMediaResponse,
} from "../../grpc/generated/post";
import { grpcCall, grpcs } from "../../utils/grpc.helper";
import { CreatePostRequest } from "../../grpc/generated/post";
import { postClient } from "../../config/grpc.client";
import { HttpStatus } from "../../utils/constents";
import { logger } from "../../utils/logger";
import { grpcToHttp } from "../../constants/http.status";
import { filterError, sendErrorResponse } from "../../utils/error.util";

export const submitPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const request: CreatePostRequest = { ...req.body, userId: req.user?.id };
    const response: CreatePostResponse = await grpcs<
      PostServiceClient,
      CreatePostRequest,
      CreatePostResponse
    >(postClient, "createPost", request);

    console.log(
      "this is the response response is comming ..................,:",
      response
    );

    res
      .status(HttpStatus.OK)
      .json({ success: true, message: response.message });
  } catch (err: any) {
    logger.error("Error in post creation", {
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

export const createPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const request: SubmitPostRequest = { ...req.body, userId: req.user?.id };
    const response: SubmitPostResponse = await grpcs<
      PostServiceClient,
      SubmitPostRequest,
      SubmitPostResponse
    >(postClient, "submitPost", request);

    console.log(
      "this is the response response is comming ..................,:",
      response
    );

    res
      .status(HttpStatus.OK)
      .json({ success: true, data : response });
  } catch (err: any) {
    logger.error("Error in post submission creation", {
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

export const listPost = async (req: Request, res: Response): Promise<void> => {
  try {
    const pageParam = req.query?.cursor as string;

    const response = await grpcs<
      PostServiceClient,
      ListPostsRequest,
      ListPostsResponse
    >(postClient, "listPosts", { pageParam });

    res.status(HttpStatus.OK).json({
      success: true,
      data: response,
    });
  } catch (err: any) {
    logger.error("Error in /feed/list-post", {
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

export const uploadMedia = async (req: Request, res: Response) => {
  try {

    console.log('upload media ====================================')
    const request: UploadMediaRequest = req.body;
    const response: UploadMediaResponse = await grpcs<
      PostServiceClient,
      UploadMediaRequest,
      UploadMediaResponse
    >(postClient, "uploadMedia", request);

    res
      .status(HttpStatus.OK)
      .json(response);
  } catch (err: any) {
    logger.error("Error in uploadMedia", {
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


export const deletePost = async (req: Request, res: Response) => {
  try {
    const request: DeletePostRequest = {postId:req.body.Id};
    const response: DeletePostResponse = await grpcs<
      PostServiceClient,
      DeletePostRequest,
      DeletePostResponse
    >(postClient, "deletePost", request);
    
    console.log('this is the delete post result ==================------------------------------', response)
    res
      .status(HttpStatus.OK)
      .json({ success: true, deletedPost: response });
  } catch (err: any) {
    logger.error("Error in delete post ", {
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


export const deleteUnuseMedias = async (req: Request, res: Response) => {
  try {

    const response: DeleteUnusedMediasResponse = await grpcs<
      PostServiceClient,
      DeleteUnusedMediasRequest,
      DeleteUnusedMediasResponse
    >(postClient, "deleteUnusedMedias", {});
    
    res
      .status(HttpStatus.OK)
      .json(response);
  } catch (err: any) {
    logger.error("Error in delete post ", {
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

// import { Request, Response } from "express";
// import {
//   CreatePostRequest,
//   CreatePostResponse,
//   SubmitPostRequest,
//   SubmitPostResponse,
//   ListPostsRequest,
//   ListPostsResponse,
//   UploadMediaRequest,
//   UploadMediaResponse,
//   DeletePostRequest,
//   DeletePostResponse,
//   DeleteUnusedMediasRequest,
//   DeleteUnusedMediasResponse,
//   PostServiceClient,
// } from "../../grpc/generated/post";
// import { grpcs } from "../../utils/grpc.helper";
// import { postClient } from "../../config/grpc.client";
// import { handleGrpcCall } from "../../utils/grpcControllerHandler";

// //  submitPost
// export const submitPost = async (req: Request, res: Response) => {
//   const request: CreatePostRequest = { ...req.body, userId: req.user?.id };
//   await handleGrpcCall<CreatePostRequest, CreatePostResponse>(
//     res,
//     "submitPost",
//     () => grpcs(postClient, "createPost", request),
//     (response) => ({ message: response.message })
//   );
// };

// //  createPost
// export const createPost = async (req: Request, res: Response) => {
//   const request: SubmitPostRequest = { ...req.body, userId: req.user?.id };
//   await handleGrpcCall<SubmitPostRequest, SubmitPostResponse>(
//     res,
//     "createPost",
//     () => grpcs(postClient, "submitPost", request)
//   );
// };

// //  listPost
// export const listPost = async (req: Request, res: Response) => {
//   const pageParam = req.query?.cursor as string;
//   const request: ListPostsRequest = { pageParam };
//   await handleGrpcCall<ListPostsRequest, ListPostsResponse>(
//     res,
//     "listPost",
//     () => grpcs(postClient, "listPosts", request)
//   );
// };

// //  uploadMedia
// export const uploadMedia = async (req: Request, res: Response) => {
//   const request: UploadMediaRequest = req.body;
//   await handleGrpcCall<UploadMediaRequest, UploadMediaResponse>(
//     res,
//     "uploadMedia",
//     () => grpcs(postClient, "uploadMedia", request)
//   );
// };

// //  deletePost
// export const deletePost = async (req: Request, res: Response) => {
//   const request: DeletePostRequest = { postId: req.body.Id };
//   await handleGrpcCall<DeletePostRequest, DeletePostResponse>(
//     res,
//     "deletePost",
//     () => grpcs(postClient, "deletePost", request),
//     (response) => ({ deletedPost: response })
//   );
// };

// //  deleteUnusedMedias
// export const deleteUnuseMedias = async (req: Request, res: Response) => {
//   const request: DeleteUnusedMediasRequest = { postId: req.body.Id };
//   await handleGrpcCall<DeleteUnusedMediasRequest, DeleteUnusedMediasResponse>(
//     res,
//     "deleteUnusedMedias",
//     () => grpcs(postClient, "deleteUnusedMedias", request),
//     (response) => ({ deletedPost: response })
//   );
// };
