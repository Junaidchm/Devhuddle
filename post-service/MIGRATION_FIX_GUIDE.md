# Migration Fix Guide - PostgreSQL Enum Issue

## Problem

PostgreSQL error: `unsafe use of new value "PENDING" of enum type "ReportStatus"`

PostgreSQL requires enum values to be committed in a separate transaction before they can be used as default values.

## Solution

You need to create a manual migration that splits the enum addition into two steps:

### Step 1: Create Manual Migration SQL

Create a new migration file manually:

```bash
cd post-service
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_enum_values_manually
```

Then create `migration.sql` in that directory:

```sql
-- Step 1: Add new enum values (in separate transaction)
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_APPROVED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_REMOVED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_IGNORED';

-- Step 2: Add new enum type
DO $$ BEGIN
    CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Step 3: Add new ShareType values
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'TO_FEED';
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'PRIVATE_MESSAGE';
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'TO_CONVERSATION';

-- Step 4: Add new ReportReason values
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'FALSE_INFORMATION';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'COPYRIGHT_VIOLATION';
```

### Step 2: Mark Migration as Applied

After running the SQL manually, mark it as applied:

```bash
npx prisma migrate resolve --applied <migration_name>
```

### Step 3: Create Schema Migration

Then run the normal Prisma migration:

```bash
npx prisma migrate dev --name add_post_features
```

## Alternative: Remove Default Values Temporarily

If you want Prisma to handle it automatically, temporarily remove the default values:

1. In `schema.prisma`, change:
   ```prisma
   status     ReportStatus     @default(PENDING)
   ```
   to:
   ```prisma
   status     ReportStatus?
   ```

2. Run migration
3. Then add back the default in a second migration

## Quick Fix (Recommended)

Run this SQL directly in your database:

```sql
-- Add enum values first
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_APPROVED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_REMOVED';
ALTER TYPE "ReportStatus" ADD VALUE IF NOT EXISTS 'RESOLVED_IGNORED';

-- Create ReportSeverity enum
DO $$ BEGIN
    CREATE TYPE "ReportSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add ShareType values
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'TO_FEED';
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'PRIVATE_MESSAGE';
ALTER TYPE "ShareType" ADD VALUE IF NOT EXISTS 'TO_CONVERSATION';

-- Add ReportReason values
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'FALSE_INFORMATION';
ALTER TYPE "ReportReason" ADD VALUE IF NOT EXISTS 'COPYRIGHT_VIOLATION';
```

Then reset the failed migration and try again:

```bash
npx prisma migrate resolve --rolled-back <failed_migration_name>
npx prisma migrate dev --name add_post_features
```
