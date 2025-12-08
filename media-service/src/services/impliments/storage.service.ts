import {
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, R2_BUCKET_NAME, CDN_URL, PRESIGNED_URL_EXPIRATION } from "../../config/r2.config";
import {
  IStorageService,
  PresignedUrlOptions,
  PresignedUrlResult,
  MultipartUploadInitResult,
  MultipartUploadPart,
} from "../interfaces/IStorageService";
import logger from "../../utils/logger.util";

export class StorageService implements IStorageService {
  async generatePresignedPutUrl(
    key: string,
    contentType: string,
    options?: PresignedUrlOptions
  ): Promise<PresignedUrlResult> {
    try {
      const expiresIn = options?.expiresIn || PRESIGNED_URL_EXPIRATION;
      
      const command = new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
        ...(options?.contentLength && { ContentLength: options.contentLength }),
      });

      const url = await getSignedUrl(r2Client, command, {
        expiresIn,
      });

      return {
        url,
        key,
        expiresAt: Date.now() + expiresIn * 1000,
      };
    } catch (error: any) {
      logger.error("Failed to generate presigned PUT URL", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async generatePresignedGetUrl(
    key: string,
    options?: PresignedUrlOptions
  ): Promise<PresignedUrlResult> {
    try {
      const expiresIn = options?.expiresIn || PRESIGNED_URL_EXPIRATION;

      const command = new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      const url = await getSignedUrl(r2Client, command, {
        expiresIn,
      });

      return {
        url,
        key,
        expiresAt: Date.now() + expiresIn * 1000,
      };
    } catch (error: any) {
      logger.error("Failed to generate presigned GET URL", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async verifyFileExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      await r2Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      logger.error("Failed to verify file existence", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async getFileMetadata(key: string): Promise<{
    size: number;
    contentType: string;
    etag: string;
  }> {
    try {
      const command = new HeadObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      const response = await r2Client.send(command);

      return {
        size: response.ContentLength || 0,
        contentType: response.ContentType || "application/octet-stream",
        etag: response.ETag?.replace(/"/g, "") || "",
      };
    } catch (error: any) {
      logger.error("Failed to get file metadata", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async deleteFile(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
      });

      await r2Client.send(command);
      logger.info("File deleted from storage", { key });
    } catch (error: any) {
      logger.error("Failed to delete file", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async deleteFiles(keys: string[]): Promise<void> {
    try {
      await Promise.all(keys.map((key) => this.deleteFile(key)));
      logger.info("Files deleted from storage", { count: keys.length });
    } catch (error: any) {
      logger.error("Failed to delete files", {
        error: error.message,
        count: keys.length,
      });
      throw error;
    }
  }

  async initMultipartUpload(
    key: string,
    contentType: string
  ): Promise<MultipartUploadInitResult> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
      });

      const response = await r2Client.send(command);

      if (!response.UploadId) {
        throw new Error("Failed to initialize multipart upload");
      }

      return {
        uploadId: response.UploadId,
        key,
      };
    } catch (error: any) {
      logger.error("Failed to initialize multipart upload", {
        error: error.message,
        key,
      });
      throw error;
    }
  }

  async generatePresignedPartUrl(
    key: string,
    uploadId: string,
    partNumber: number
  ): Promise<string> {
    try {
      const command = new UploadPartCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      });

      const url = await getSignedUrl(r2Client, command, {
        expiresIn: PRESIGNED_URL_EXPIRATION,
      });

      return url;
    } catch (error: any) {
      logger.error("Failed to generate presigned part URL", {
        error: error.message,
        key,
        uploadId,
        partNumber,
      });
      throw error;
    }
  }

  async completeMultipartUpload(
    key: string,
    uploadId: string,
    parts: MultipartUploadPart[]
  ): Promise<string> {
    try {
      const command = new CompleteMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({
            PartNumber: part.partNumber,
            ETag: part.etag,
          })),
        },
      });

      const response = await r2Client.send(command);

      if (!response.Location) {
        throw new Error("Failed to complete multipart upload");
      }

      logger.info("Multipart upload completed", { key, uploadId });
      return response.Location;
    } catch (error: any) {
      logger.error("Failed to complete multipart upload", {
        error: error.message,
        key,
        uploadId,
      });
      throw error;
    }
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    try {
      const command = new AbortMultipartUploadCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        UploadId: uploadId,
      });

      await r2Client.send(command);
      logger.info("Multipart upload aborted", { key, uploadId });
    } catch (error: any) {
      logger.error("Failed to abort multipart upload", {
        error: error.message,
        key,
        uploadId,
      });
      throw error;
    }
  }

  getCdnUrl(key: string): string {
    return `${CDN_URL}/${key}`;
  }
}

