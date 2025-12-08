import { S3Client } from "@aws-sdk/client-s3";

/**
 * Cloudflare R2 Configuration
 * R2 is S3-compatible, so we use AWS SDK
 */
export const r2Client = new S3Client({
  region: "auto", // R2 uses "auto" for region
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
export const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET_NAME}`;
export const CDN_URL = process.env.CDN_URL || R2_PUBLIC_URL;

// Upload configuration
export const PRESIGNED_URL_EXPIRATION = parseInt(process.env.PRESIGNED_URL_EXPIRATION || "900", 10); // 15 minutes default
export const MAX_FILE_SIZE = {
  IMAGE: parseInt(process.env.MAX_IMAGE_SIZE || "10485760", 10), // 10MB default
  VIDEO: parseInt(process.env.MAX_VIDEO_SIZE || "104857600", 10), // 100MB default
  PROFILE_IMAGE: parseInt(process.env.MAX_PROFILE_IMAGE_SIZE || "5242880", 10), // 5MB default
};
export const MULTIPART_THRESHOLD = parseInt(process.env.MULTIPART_THRESHOLD || "5242880", 10); // 5MB default
export const MULTIPART_PART_SIZE = parseInt(process.env.MULTIPART_PART_SIZE || "5242880", 10); // 5MB per part

