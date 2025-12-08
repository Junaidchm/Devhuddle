export interface PresignedUrlOptions {
  expiresIn?: number; // seconds
  contentType?: string;
  contentLength?: number;
}

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresAt: number;
}

export interface MultipartUploadInitResult {
  uploadId: string;
  key: string;
}

export interface MultipartUploadPart {
  partNumber: number;
  etag: string;
}

export interface IStorageService {
  /**
   * Generate presigned PUT URL for direct upload
   */
  generatePresignedPutUrl(
    key: string,
    contentType: string,
    options?: PresignedUrlOptions
  ): Promise<PresignedUrlResult>;

  /**
   * Generate presigned GET URL for file access
   */
  generatePresignedGetUrl(
    key: string,
    options?: PresignedUrlOptions
  ): Promise<PresignedUrlResult>;

  /**
   * Verify file exists in storage
   */
  verifyFileExists(key: string): Promise<boolean>;

  /**
   * Get file metadata
   */
  getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    etag: string;
  }>;

  /**
   * Delete file from storage
   */
  deleteFile(key: string): Promise<void>;

  /**
   * Delete multiple files
   */
  deleteFiles(keys: string[]): Promise<void>;

  /**
   * Initialize multipart upload
   */
  initMultipartUpload(
    key: string,
    contentType: string
  ): Promise<MultipartUploadInitResult>;

  /**
   * Generate presigned URL for multipart upload part
   */
  generatePresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string>;

  /**
   * Complete multipart upload
   */
  completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[]
  ): Promise<string>;

  /**
   * Abort multipart upload
   */
  abortMultipartUpload(key: string, uploadId: string): Promise<void>;

  /**
   * Generate CDN URL from storage key
   */
  getCdnUrl(key: string): string;
}

