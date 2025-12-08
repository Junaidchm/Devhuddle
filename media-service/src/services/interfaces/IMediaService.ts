import { MediaType } from "@prisma/client";

export interface UploadSessionRequest {
  userId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  mediaType: MediaType;
}

export interface UploadSessionResponse {
  mediaId: string;
  uploadUrl: string;
  storageKey: string;
  expiresAt: number;
  useMultipart?: boolean;
  uploadId?: string;
  partSize?: number;
  totalParts?: number;
}

export interface CompleteUploadRequest {
  mediaId: string;
  userId: string;
}

export interface CompleteUploadResponse {
  mediaId: string;
  cdnUrl: string;
  status: string;
}

export interface ValidateMediaRequest {
  mediaIds: string[];
  userId: string;
}

export interface ValidateMediaResponse {
  valid: boolean;
  invalidMediaIds?: string[];
  message?: string;
}

export interface IMediaService {
  createUploadSession(request: UploadSessionRequest): Promise<UploadSessionResponse>;
  completeUpload(request: CompleteUploadRequest): Promise<CompleteUploadResponse>;
  getMediaById(mediaId: string, userId: string): Promise<any>;
  deleteMedia(mediaId: string, userId: string): Promise<void>;
  validateMediaOwnership(request: ValidateMediaRequest): Promise<ValidateMediaResponse>;
  linkMediaToPost(mediaIds: string[], postId: string, userId: string): Promise<void>;
  unlinkMediaFromPost(mediaIds: string[], userId: string): Promise<void>;
}

