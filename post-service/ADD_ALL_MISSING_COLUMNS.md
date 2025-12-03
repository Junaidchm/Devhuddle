# Fixed: All Missing Columns Added to Posts Table

## Problem
Multiple columns were missing from the `posts` table that are defined in the Prisma schema:
- `currentVersion` ✅ (fixed earlier)
- `isEditing` ✅ (just fixed)
- `editCount`
- `lastEditedAt`
- `isHidden`
- `hiddenAt`
- `hiddenReason`
- `sharingDisabled`
- `canonicalUrl`

## Solution
Added all missing columns in a single SQL execution to avoid repeated errors.

## Columns Added

### Post Editing and Versioning
- `currentVersion` - INTEGER NOT NULL DEFAULT 1
- `isEditing` - BOOLEAN NOT NULL DEFAULT false
- `editCount` - INTEGER NOT NULL DEFAULT 0
- `lastEditedAt` - TIMESTAMP(3) (nullable)

### Post Reporting and Moderation
- `isHidden` - BOOLEAN NOT NULL DEFAULT false
- `hiddenAt` - TIMESTAMP(3) (nullable)
- `hiddenReason` - TEXT (nullable)
- `sharingDisabled` - BOOLEAN NOT NULL DEFAULT false
- `canonicalUrl` - TEXT (nullable)

## SQL Executed
```sql
ALTER TABLE "posts" 
  ADD COLUMN IF NOT EXISTS "isEditing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "editCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastEditedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "isHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hiddenAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "hiddenReason" TEXT,
  ADD COLUMN IF NOT EXISTS "sharingDisabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
```

## Status
✅ All columns have been successfully added to the database.

## Next Steps
The service should now work without column-related errors. If you encounter any other missing column errors, you can:

1. **Use Prisma db push** (recommended for development):
   ```bash
   docker exec post-service sh -c "cd /app && npx prisma db push"
   ```
   This will sync all schema changes at once.

2. **Or run the full migration**:
   ```bash
   docker exec post-service sh -c "cd /app && npx prisma migrate deploy"
   ```

## Verification
All columns from the Prisma schema should now exist in the database. The service should be able to query posts without any column-related errors.

