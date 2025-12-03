-- Fix for PostgreSQL enum migration issue
-- This script applies the migration in the correct order

-- Step 1: Create new enum type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReportSeverity') THEN
        CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;
END $$;

-- Step 2: Add new enum values (these are auto-committed)
DO $$ 
BEGIN
    -- Add to ReportReason
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'FALSE_INFORMATION' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportReason')) THEN
        ALTER TYPE "ReportReason" ADD VALUE 'FALSE_INFORMATION';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'COPYRIGHT_VIOLATION' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportReason')) THEN
        ALTER TYPE "ReportReason" ADD VALUE 'COPYRIGHT_VIOLATION';
    END IF;
    
    -- Add to ReportStatus (must add PENDING first, then commit, then use it)
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PENDING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportStatus')) THEN
        ALTER TYPE "ReportStatus" ADD VALUE 'PENDING';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESOLVED_APPROVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportStatus')) THEN
        ALTER TYPE "ReportStatus" ADD VALUE 'RESOLVED_APPROVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESOLVED_REMOVED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportStatus')) THEN
        ALTER TYPE "ReportStatus" ADD VALUE 'RESOLVED_REMOVED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'RESOLVED_IGNORED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ReportStatus')) THEN
        ALTER TYPE "ReportStatus" ADD VALUE 'RESOLVED_IGNORED';
    END IF;
    
    -- Add to ShareType
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TO_FEED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ShareType')) THEN
        ALTER TYPE "ShareType" ADD VALUE 'TO_FEED';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PRIVATE_MESSAGE' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ShareType')) THEN
        ALTER TYPE "ShareType" ADD VALUE 'PRIVATE_MESSAGE';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'TO_CONVERSATION' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'ShareType')) THEN
        ALTER TYPE "ShareType" ADD VALUE 'TO_CONVERSATION';
    END IF;
END $$;

-- Step 3: Now alter tables (enum values are committed)
-- AlterTable Report
DO $$ 
BEGIN
    -- Add columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'description') THEN
        ALTER TABLE "Report" ADD COLUMN "description" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'resolution') THEN
        ALTER TABLE "Report" ADD COLUMN "resolution" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'reviewedAt') THEN
        ALTER TABLE "Report" ADD COLUMN "reviewedAt" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'reviewedById') THEN
        ALTER TABLE "Report" ADD COLUMN "reviewedById" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Report' AND column_name = 'severity') THEN
        ALTER TABLE "Report" ADD COLUMN "severity" "ReportSeverity" NOT NULL DEFAULT 'LOW';
    END IF;
    
    -- Update default status (enum value is now committed)
    ALTER TABLE "Report" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"ReportStatus";
END $$;

-- AlterTable Share
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Share' AND column_name = 'deletedAt') THEN
        ALTER TABLE "Share" ADD COLUMN "deletedAt" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Share' AND column_name = 'sharedToUserId') THEN
        ALTER TABLE "Share" ADD COLUMN "sharedToUserId" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Share' AND column_name = 'updatedAt') THEN
        ALTER TABLE "Share" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Share' AND column_name = 'visibility') THEN
        ALTER TABLE "Share" ADD COLUMN "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC';
    END IF;
END $$;

-- AlterTable Posts
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'canonicalUrl') THEN
        ALTER TABLE "posts" ADD COLUMN "canonicalUrl" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'currentVersion') THEN
        ALTER TABLE "posts" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'editCount') THEN
        ALTER TABLE "posts" ADD COLUMN "editCount" INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hiddenAt') THEN
        ALTER TABLE "posts" ADD COLUMN "hiddenAt" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'hiddenReason') THEN
        ALTER TABLE "posts" ADD COLUMN "hiddenReason" TEXT;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'isEditing') THEN
        ALTER TABLE "posts" ADD COLUMN "isEditing" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'isHidden') THEN
        ALTER TABLE "posts" ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'lastEditedAt') THEN
        ALTER TABLE "posts" ADD COLUMN "lastEditedAt" TIMESTAMP(3);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'sharingDisabled') THEN
        ALTER TABLE "posts" ADD COLUMN "sharingDisabled" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- CreateTable PostVersion
CREATE TABLE IF NOT EXISTS "PostVersion" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "attachmentIds" TEXT[],
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedById" TEXT NOT NULL,
    CONSTRAINT "PostVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable PostShareLink
CREATE TABLE IF NOT EXISTS "PostShareLink" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "shortId" TEXT NOT NULL,
    "shareToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "clickCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PostShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PostVersion_postId_idx" ON "PostVersion"("postId");
CREATE INDEX IF NOT EXISTS "PostVersion_versionNumber_idx" ON "PostVersion"("versionNumber");
CREATE INDEX IF NOT EXISTS "PostVersion_editedAt_idx" ON "PostVersion"("editedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PostVersion_postId_versionNumber_key" ON "PostVersion"("postId", "versionNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "PostShareLink_shortId_key" ON "PostShareLink"("shortId");
CREATE UNIQUE INDEX IF NOT EXISTS "PostShareLink_shareToken_key" ON "PostShareLink"("shareToken");
CREATE INDEX IF NOT EXISTS "PostShareLink_postId_idx" ON "PostShareLink"("postId");
CREATE INDEX IF NOT EXISTS "PostShareLink_shortId_idx" ON "PostShareLink"("shortId");
CREATE INDEX IF NOT EXISTS "PostShareLink_shareToken_idx" ON "PostShareLink"("shareToken");
CREATE INDEX IF NOT EXISTS "PostShareLink_createdAt_idx" ON "PostShareLink"("createdAt");

CREATE INDEX IF NOT EXISTS "Report_severity_idx" ON "Report"("severity");
CREATE INDEX IF NOT EXISTS "Share_shareType_idx" ON "Share"("shareType");
CREATE INDEX IF NOT EXISTS "posts_isHidden_idx" ON "posts"("isHidden");

-- AddForeignKey
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PostVersion_postId_fkey'
    ) THEN
        ALTER TABLE "PostVersion" ADD CONSTRAINT "PostVersion_postId_fkey" 
        FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'PostShareLink_postId_fkey'
    ) THEN
        ALTER TABLE "PostShareLink" ADD CONSTRAINT "PostShareLink_postId_fkey" 
        FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

