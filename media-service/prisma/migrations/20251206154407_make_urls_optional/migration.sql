-- AlterTable
ALTER TABLE "media" ALTER COLUMN "cdn_url" DROP NOT NULL,
ALTER COLUMN "original_url" DROP NOT NULL;
