import { Request, Response } from "express";
import { PostServiceClient } from "../../grpc/generated/post";
import { grpcCall, grpcs } from "../../utils/grpc.helper";
import { CreatePostRequest } from "../../grpc/generated/post";
import { postClient } from "../../config/grpc.client";

export const submitPost = async (
  req: Request,
  res: Response
): Promise<void> => {
  console.log("Received /auth/signup request", { body: req.body });
  console.log('this is the req...........',req.body)
  const request = req.body;
  const response = await grpcs<PostServiceClient, CreatePostRequest, void>(
    postClient,
    "createPost",
    request 
  );
};
