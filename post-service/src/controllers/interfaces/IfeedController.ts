import { CreatePostRequest, CreatePostResponse, GeneratePresignedUrlRequest, GeneratePresignedUrlResponse } from "../../grpc/generated/post";

export interface IfeedController {
    feedPosting(req:CreatePostRequest):Promise<CreatePostResponse>
    generatePresignedUrl(req:GeneratePresignedUrlRequest):Promise<GeneratePresignedUrlResponse>
} 