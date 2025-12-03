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

export interface IProjectMediaRepository {
  createProjectMedia(data: UploadProjectMediaRequest): Promise<string>;
}


