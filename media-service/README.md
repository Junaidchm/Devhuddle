# Media Service

Microservice for handling media uploads (images and videos) using Cloudflare R2 with presigned URLs.

## Features

- ✅ Direct upload to Cloudflare R2 using presigned URLs
- ✅ Support for images and videos
- ✅ Multipart upload for large files (>5MB)
- ✅ Media metadata storage
- ✅ CDN integration
- ✅ Secure file validation
- ✅ User-based access control

## Architecture

This service follows the industrial-standard approach used by LinkedIn, Instagram, Facebook, and Twitter:

1. **Client requests upload session** → Server generates presigned URL
2. **Client uploads directly to R2** (no server bottleneck)
3. **Server verifies upload** and stores metadata
4. **CDN serves media** with optimized caching

## Setup

### 1. Prerequisites

- Node.js 20+
- PostgreSQL database
- Cloudflare R2 account and bucket

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL`: PostgreSQL connection string
- `R2_ACCOUNT_ID`: Cloudflare R2 account ID
- `R2_ACCESS_KEY_ID`: R2 access key
- `R2_SECRET_ACCESS_KEY`: R2 secret key
- `R2_BUCKET_NAME`: R2 bucket name
- `CDN_URL`: CDN URL for serving media

### 4. Set Up Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 5. Start Service

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## API Endpoints

### POST `/api/v1/media/upload-session`

Request upload session (presigned URL).

**Request Body:**
```json
{
  "fileName": "image.jpg",
  "fileType": "image/jpeg",
  "fileSize": 1024000,
  "mediaType": "POST_IMAGE"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "mediaId": "uuid",
    "uploadUrl": "https://presigned-url...",
    "storageKey": "post-image/user-id/timestamp-uuid.jpg",
    "expiresAt": 1234567890,
    "useMultipart": false
  }
}
```

### POST `/api/v1/media/:mediaId/complete`

Complete upload (verify and finalize).

**Response:**
```json
{
  "success": true,
  "data": {
    "mediaId": "uuid",
    "cdnUrl": "https://cdn.example.com/media/...",
    "status": "UPLOADED"
  }
}
```

### GET `/api/v1/media/:mediaId`

Get media information.

### DELETE `/api/v1/media/:mediaId`

Delete media (removes from storage and database).

## Client Usage

```typescript
import { useDirectUpload } from "@/src/customHooks/useDirectUpload";

function MyComponent() {
  const { upload, isUploading, uploadProgress } = useDirectUpload({
    onSuccess: (result) => {
      console.log("Upload complete:", result.cdnUrl);
    },
    onError: (error) => {
      console.error("Upload failed:", error);
    },
    onProgress: (progress) => {
      console.log("Progress:", progress);
    },
  });

  const handleFileSelect = async (file: File) => {
    await upload(file, "POST_IMAGE");
  };

  return (
    <div>
      <input type="file" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
      }} />
      {isUploading && <progress value={uploadProgress} max={100} />}
    </div>
  );
}
```

## Media Types

- `POST_IMAGE`: Images for posts (max 10MB)
- `POST_VIDEO`: Videos for posts (max 100MB)
- `PROFILE_IMAGE`: Profile pictures (max 5MB)

## Storage Structure

Files are stored in R2 with the following structure:

```
{mediaType}/{userId}/{timestamp}-{uuid}.{ext}
```

Example:
```
post-image/80922465-c281-4331-b931-7932da62c316/1763446881194-abc123.jpg
```

## Integration with Post Service

Media is linked to posts via the `postId` field. When creating a post:

1. Upload media using this service
2. Get `mediaId` from upload result
3. Pass `mediaIds` array to Post Service when creating post
4. Post Service validates and links media to post

## Future Enhancements

- [ ] Thumbnail generation (background jobs)
- [ ] Video transcoding (multiple qualities)
- [ ] HLS streaming support
- [ ] Image optimization (WebP conversion)
- [ ] Processing job queue (RabbitMQ/Kafka)

## License

ISC

