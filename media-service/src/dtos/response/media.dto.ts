/**
 * Response DTO for media
 */
export interface MediaResponseDto {
  id: string;
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  url: string;
  status: string;
  mediaType: string;
  postId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Response DTO for upload session
 */
export interface UploadSessionResponseDto {
  sessionId: string;
  uploadUrl: string;
  s3Key: string;
  expiresAt: Date;
}
