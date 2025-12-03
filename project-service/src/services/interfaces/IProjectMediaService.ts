export interface UploadProjectMediaRequest {
  url: string;
  type: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  duration?: number;
}

export interface UploadProjectMediaResponse {
  mediaId: string;
}

export interface IProjectMediaService {
  uploadProjectMedia(req: UploadProjectMediaRequest): Promise<UploadProjectMediaResponse>;
}


