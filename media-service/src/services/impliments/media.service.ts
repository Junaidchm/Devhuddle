import { MediaType, MediaStatus, Media } from "@prisma/client";
import { ThumbnailUrl, TranscodedUrlMap, MediaValidationResult, ValidatedMediaItem } from "../../types/common.types";
import { IMediaService, UploadSessionRequest, UploadSessionResponse, CompleteUploadRequest, CompleteUploadResponse } from "../interfaces/IMediaService";
import { IStorageService } from "../interfaces/IStorageService";
import { IMediaRepository } from "../../repositories/interfaces/IMediaRepository";
import { StorageService } from "./storage.service";
import { MAX_FILE_SIZE, MULTIPART_THRESHOLD, MULTIPART_PART_SIZE } from "../../config/r2.config";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import logger from "../../utils/logger.util";
import { CustomError } from "../../utils/error.util";

export class MediaService implements IMediaService {
  private storageService: IStorageService;

  constructor(
    private _mediaRepository: IMediaRepository
  ) {
    this.storageService = new StorageService();
  }

  async createUploadSession(
    request: UploadSessionRequest
  ): Promise<UploadSessionResponse> {
    try {
      // Validate file type
      this.validateFileType(request.fileType, request.mediaType);

      // Validate file size
      this.validateFileSize(request.fileSize, request.mediaType);

      // Generate storage key
      const extension = path.extname(request.fileName);
      const storageKey = this.generateStorageKey(
        request.mediaType,
        request.userId,
        extension
      );

      // Check if multipart upload is needed
      const useMultipart = request.fileSize > MULTIPART_THRESHOLD;
      let uploadId: string | undefined;
      let partSize: number | undefined;
      let totalParts: number | undefined;

      if (useMultipart) {
        // Initialize multipart upload
        const multipartResult = await this.storageService.initMultipartUpload(
          storageKey,
          request.fileType
        );
        uploadId = multipartResult.uploadId;
        partSize = MULTIPART_PART_SIZE;
        totalParts = Math.ceil(request.fileSize / MULTIPART_PART_SIZE);
      }

      // Generate presigned URL
      const presignedResult = await this.storageService.generatePresignedPutUrl(
        storageKey,
        request.fileType,
        {
          contentLength: request.fileSize,
        }
      );

      // Create media record
      const media = await this._mediaRepository.create({
        userId: request.userId,
        mediaType: request.mediaType,
        storageKey,
        fileName: request.fileName,
        fileSize: BigInt(request.fileSize),
        mimeType: request.fileType,
        uploadId,
      });

      logger.info("Upload session created", {
        mediaId: media.id,
        userId: request.userId,
        useMultipart,
      });

      return {
        mediaId: media.id,
        uploadUrl: presignedResult.url,
        storageKey,
        expiresAt: presignedResult.expiresAt,
        useMultipart,
        uploadId,
        partSize,
        totalParts,
      };
    } catch (error: unknown) {
      logger.error("Failed to create upload session", {
        error: (error as Error).message,
        request,
      });
      throw error;
    }
  }

  async completeUpload(
    request: CompleteUploadRequest
  ): Promise<CompleteUploadResponse> {
    try {
      // Get media record
      const media = await this._mediaRepository.findById(request.mediaId);

      if (!media) {
        throw new CustomError(404, "Media not found");
      }

      // Verify ownership
      if (media.userId !== request.userId) {
        throw new CustomError(403, "Unauthorized");
      }

      // Verify file exists in storage
      const exists = await this.storageService.verifyFileExists(media.storageKey);
      if (!exists) {
        throw new CustomError(404, "File not found in storage");
      }

      // Get file metadata
      const metadata = await this.storageService.getFileMetadata(media.storageKey);

      // Generate CDN URL
      const cdnUrl = this.storageService.getCdnUrl(media.storageKey);
      const originalUrl = this.storageService.getCdnUrl(media.storageKey);

      // Update media record
      const updatedMedia = await this._mediaRepository.update(media.id, {
        status: "UPLOADED",
        cdnUrl,
        originalUrl,
        ...(metadata.size && { fileSize: BigInt(metadata.size) }),
      });

      logger.info("Upload completed", {
        mediaId: media.id,
        userId: request.userId,
      });

      // TODO: Queue processing job (thumbnails/transcoding)
      // This will be implemented in the processing pipeline

      // Ensure cdnUrl is set (it should be since we just updated it)
      if (!updatedMedia.cdnUrl) {
        throw new CustomError(500, "Failed to generate CDN URL");
      }

      return {
        mediaId: updatedMedia.id,
        cdnUrl: updatedMedia.cdnUrl,
        status: updatedMedia.status,
      };
    } catch (error: unknown) {
      logger.error("Failed to complete upload", {
        error: (error as Error).message,
        request,
      });
      throw error;
    }
  }

  async getMediaById(mediaId: string, userId: string): Promise<Media> {
    try {
      const media = await this._mediaRepository.findById(mediaId);

      if (!media) {
        throw new CustomError(404, "Media not found");
      }

      // Verify ownership
      if (media.userId !== userId) {
        throw new CustomError(403, "Unauthorized");
      }

      return media;
    } catch (error: unknown) {
      logger.error("Failed to get media", {
        error: (error as Error).message,
        mediaId,
        userId,
      });
      throw error;
    }
  }

  async deleteMedia(mediaId: string, userId: string): Promise<void> {
    try {
      const media = await this._mediaRepository.findById(mediaId);

      if (!media) {
        throw new CustomError(404, "Media not found");
      }

      // Verify ownership
      if (media.userId !== userId) {
        throw new CustomError(403, "Unauthorized");
      }

      // Delete from storage
      await this.storageService.deleteFile(media.storageKey);

      // Delete thumbnails if they exist
      if (media.thumbnailUrls) {
        const thumbnails = media.thumbnailUrls as unknown as ThumbnailUrl[];
        if (Array.isArray(thumbnails)) {
          const thumbnailKeys = thumbnails.map((t) => t.storageKey).filter(Boolean);
          if (thumbnailKeys.length > 0) {
            await this.storageService.deleteFiles(thumbnailKeys);
          }
        }
      }

      // Delete transcoded videos if they exist
      if (media.transcodedUrls) {
        const transcoded = media.transcodedUrls as unknown as TranscodedUrlMap;
        if (typeof transcoded === "object") {
          const transcodedKeys = Object.values(transcoded)
            .map((url) => {
              // Extract key from URL
              if (typeof url === "string") {
                const parts = url.split("/");
                return parts[parts.length - 1];
              }
              return null;
            })
            .filter((key): key is string => Boolean(key));
            
          if (transcodedKeys.length > 0) {
            await this.storageService.deleteFiles(transcodedKeys);
          }
        }
      }

      // Delete database record
      await this._mediaRepository.delete(mediaId);

      logger.info("Media deleted", { mediaId, userId });
    } catch (error: unknown) {
      logger.error("Failed to delete media", {
        error: (error as Error).message,
        mediaId,
        userId,
      });
      throw error;
    }
  }

  async validateMediaOwnership(
    request: { mediaIds: string[]; userId: string }
  ): Promise<MediaValidationResult> {
    try {
      const invalidMediaIds: string[] = [];
      const validMediaValues: ValidatedMediaItem[] = [];
      
      // Check each media
      for (const mediaId of request.mediaIds) {
        const media = await this._mediaRepository.findById(mediaId);
        
        if (!media) {
          invalidMediaIds.push(mediaId);
          continue;
        }

        // Check ownership
        if (media.userId !== request.userId) {
          invalidMediaIds.push(mediaId);
          continue;
        }

        // Check if already linked to another post
        if (media.postId) {
          invalidMediaIds.push(mediaId);
          continue;
        }

        validMediaValues.push({
          ...media,
          fileSize: media.fileSize.toString(),
          thumbnailUrls: media.thumbnailUrls as unknown as ThumbnailUrl[],
          transcodedUrls: media.transcodedUrls as unknown as TranscodedUrlMap,
        });
      }

      if (invalidMediaIds.length > 0) {
        return {
          valid: false,
          invalidMediaIds,
          message: `Invalid media IDs: ${invalidMediaIds.join(", ")}`,
        };
      }

      return {
        valid: true,
        validMedia: validMediaValues,
      };
    } catch (error: unknown) {
      logger.error("Failed to validate media ownership", {
        error: (error as Error).message,
        request,
      });
      throw error;
    }
  }

  async linkMediaToPost(
    mediaIds: string[],
    postId: string,
    userId: string
  ): Promise<void> {
    try {
      // Verify all media belong to user
      for (const mediaId of mediaIds) {
        const media = await this._mediaRepository.findById(mediaId);
        if (!media) {
          throw new CustomError(404, `Media ${mediaId} not found`);
        }
        if (media.userId !== userId) {
          throw new CustomError(403, `Unauthorized access to media ${mediaId}`);
        }
        if (media.postId && media.postId !== postId) {
          throw new CustomError(400, `Media ${mediaId} is already linked to another post`);
        }
      }

      // Link media to post
      for (const mediaId of mediaIds) {
        await this._mediaRepository.update(mediaId, { postId });
      }

      logger.info("Media linked to post", { mediaIds, postId, userId });
    } catch (error: unknown) {
      logger.error("Failed to link media to post", {
        error: (error as Error).message,
        mediaIds,
        postId,
        userId,
      });
      throw error;
    }
  }

  async unlinkMediaFromPost(
    mediaIds: string[],
    userId: string
  ): Promise<void> {
    try {
      // Verify all media belong to user
      for (const mediaId of mediaIds) {
        const media = await this._mediaRepository.findById(mediaId);
        if (!media) {
          throw new CustomError(404, `Media ${mediaId} not found`);
        }
        if (media.userId !== userId) {
          throw new CustomError(403, `Unauthorized access to media ${mediaId}`);
        }
      }

      // Unlink media from post
      for (const mediaId of mediaIds) {
        await this._mediaRepository.update(mediaId, { postId: null });
      }

      logger.info("Media unlinked from post", { mediaIds, userId });
    } catch (error: unknown) {
      logger.error("Failed to unlink media from post", {
        error: (error as Error).message,
        mediaIds,
        userId,
      });
      throw error;
    }
  }

  private validateFileType(fileType: string, mediaType: MediaType): void {
    const allowedImageTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const allowedVideoTypes = ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"];
    const allowedAudioTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/webm", "audio/ogg", "audio/m4a"];
    const allowedDocumentTypes = [
      "application/pdf", 
      "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "text/plain",
      "application/zip",
      "application/x-zip-compressed"
    ];

    const normalizedType = fileType.toLowerCase();

    if (mediaType === "POST_IMAGE" || mediaType === "PROFILE_IMAGE" || mediaType === "CHAT_IMAGE") {
      if (!allowedImageTypes.includes(normalizedType)) {
        throw new CustomError(400, `Invalid image type. Allowed: ${allowedImageTypes.join(", ")}`);
      }
    } else if (mediaType === "POST_VIDEO" || mediaType === "CHAT_VIDEO") {
      if (!allowedVideoTypes.includes(normalizedType)) {
        throw new CustomError(400, `Invalid video type. Allowed: ${allowedVideoTypes.join(", ")}`);
      }
    } else if (mediaType === "CHAT_AUDIO") {
      if (!allowedAudioTypes.includes(normalizedType)) {
        throw new CustomError(400, `Invalid audio type. Allowed: ${allowedAudioTypes.join(", ")}`);
      }
    } else if (mediaType === "CHAT_FILE") {
      // For generic files, we might be more lenient or check strict list
      if (!allowedDocumentTypes.includes(normalizedType)) {
        throw new CustomError(400, `Invalid file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, TXT, ZIP`);
      }
    }
  }

  private validateFileSize(fileSize: number, mediaType: MediaType): void {
    let maxSize: number;

    switch (mediaType) {
      case "PROFILE_IMAGE":
        maxSize = MAX_FILE_SIZE.PROFILE_IMAGE;
        break;
      case "POST_IMAGE":
        maxSize = MAX_FILE_SIZE.IMAGE;
        break;
      case "POST_VIDEO":
        maxSize = MAX_FILE_SIZE.VIDEO;
        break;
      case "CHAT_IMAGE":
        maxSize = MAX_FILE_SIZE.CHAT_IMAGE;
        break;
      case "CHAT_VIDEO":
        maxSize = MAX_FILE_SIZE.CHAT_VIDEO;
        break;
      case "CHAT_AUDIO":
        maxSize = MAX_FILE_SIZE.CHAT_AUDIO;
        break;
      case "CHAT_FILE":
        maxSize = MAX_FILE_SIZE.CHAT_FILE;
        break;
      default:
        maxSize = MAX_FILE_SIZE.IMAGE; // Default fallback
    }

    if (fileSize > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(2);
      throw new CustomError(400, `File size exceeds maximum allowed size of ${maxSizeMB}MB`);
    }
  }

  private generateStorageKey(
    mediaType: MediaType,
    userId: string,
    extension: string
  ): string {
    const timestamp = Date.now();
    const uuid = uuidv4();
    const typePrefix = mediaType.toLowerCase().replace("_", "-");

    return `${typePrefix}/${userId}/${timestamp}-${uuid}${extension}`;
  }
}

