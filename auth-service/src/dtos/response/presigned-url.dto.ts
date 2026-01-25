/**
 * Response DTO for S3 presigned URL
 */
export interface PresignedUrlResponseDto {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}
