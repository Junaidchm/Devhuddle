-- Quick fix: Add missing currentVersion column to posts table
-- This column is defined in the Prisma schema but missing from the database

-- Add currentVersion column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'posts' AND column_name = 'currentVersion'
    ) THEN
        ALTER TABLE "posts" ADD COLUMN "currentVersion" INTEGER NOT NULL DEFAULT 1;
        RAISE NOTICE 'Added currentVersion column to posts table';
    ELSE
        RAISE NOTICE 'currentVersion column already exists';
    END IF;
END $$;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'posts' AND column_name = 'currentVersion';

