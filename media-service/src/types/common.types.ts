// Thumbnail URL structure
export interface ThumbnailUrl {
  cdnUrl: string;
  storageKey: string;
  [key: string]: unknown;
}

// Transcoded URL structure (e.g., "720p": "https://...")
export interface TranscodedUrlMap {
  [quality: string]: string;
}

// Media validation response
export interface MediaValidationResult {
  valid: boolean;
  invalidMediaIds?: string[];
  message?: string;
  validMedia?: ValidatedMediaItem[];
}

export interface ValidatedMediaItem {
  id: string;
  mediaType: string;
  cdnUrl?: string | null;
  originalUrl?: string | null;
  thumbnailUrls?: ThumbnailUrl[];
  transcodedUrls?: TranscodedUrlMap; // Added this
  [key: string]: unknown;
}
