-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('POST_IMAGE', 'POST_VIDEO', 'PROFILE_IMAGE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "post_id" TEXT,
    "media_type" "MediaType" NOT NULL,
    "storage_key" TEXT NOT NULL,
    "cdn_url" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "duration" INTEGER,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "thumbnail_urls" JSONB,
    "transcoded_urls" JSONB,
    "hls_url" TEXT,
    "upload_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_thumbnails" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "cdn_url" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_thumbnails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "video_qualities" (
    "id" TEXT NOT NULL,
    "media_id" TEXT NOT NULL,
    "quality" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "cdn_url" TEXT NOT NULL,
    "hls_manifest_url" TEXT,
    "bitrate" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "video_qualities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_user_id_idx" ON "media"("user_id");

-- CreateIndex
CREATE INDEX "media_post_id_idx" ON "media"("post_id");

-- CreateIndex
CREATE INDEX "media_status_idx" ON "media"("status");

-- CreateIndex
CREATE INDEX "media_created_at_idx" ON "media"("created_at");

-- CreateIndex
CREATE INDEX "media_media_type_idx" ON "media"("media_type");

-- CreateIndex
CREATE INDEX "media_thumbnails_media_id_idx" ON "media_thumbnails"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_thumbnails_media_id_size_key" ON "media_thumbnails"("media_id", "size");

-- CreateIndex
CREATE INDEX "video_qualities_media_id_idx" ON "video_qualities"("media_id");

-- CreateIndex
CREATE UNIQUE INDEX "video_qualities_media_id_quality_key" ON "video_qualities"("media_id", "quality");

-- AddForeignKey
ALTER TABLE "media_thumbnails" ADD CONSTRAINT "media_thumbnails_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "video_qualities" ADD CONSTRAINT "video_qualities_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;
