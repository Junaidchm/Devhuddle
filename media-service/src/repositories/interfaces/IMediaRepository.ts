import { Media, MediaStatus, MediaType, Prisma } from "@prisma/client";

export interface CreateMediaData {
  userId: string;
  mediaType: MediaType;
  storageKey: string;
  fileName: string;
  fileSize: bigint;
  mimeType: string;
  uploadId?: string;
}

export interface UpdateMediaData {
  status?: MediaStatus;
  postId?: string | null;
  cdnUrl?: string;
  originalUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  metadata?: Prisma.InputJsonValue;
  thumbnailUrls?: Prisma.InputJsonValue;
  transcodedUrls?: Prisma.InputJsonValue;
  hlsUrl?: string;
}

export interface IMediaRepository {
  create(data: CreateMediaData): Promise<Media>;
  findById(id: string): Promise<Media | null>;
  findByUserId(userId: string, limit?: number, offset?: number): Promise<Media[]>;
  findByPostId(postId: string): Promise<Media[]>;
  findUnusedMedia(olderThanHours?: number): Promise<Partial<Media>[]>;
  update(id: string, data: UpdateMediaData): Promise<Media>;
  delete(id: string): Promise<void>;
  deleteMany(ids: string[]): Promise<number>;
  updateStatus(id: string, status: MediaStatus): Promise<Media>;
}

