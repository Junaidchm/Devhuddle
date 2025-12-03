-- Add missing currentVersion column to posts table
ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;

