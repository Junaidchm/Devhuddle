# UploadThing Root Cause Analysis & Fix

## 🔴 ROOT CAUSE

The timeout error occurs in UploadThing's metadata registration step:
- Error: `POST https://sea1.ingest.uploadthing.com/route-metadata` → TIMEOUT
- Callback URL: `http://localhost:3000/api/uploadthing` (UNREACHABLE from UploadThing servers)
- When `awaitServerData: true`, UploadThing waits for callback response
- Since localhost is unreachable, metadata registration times out
- Our callback NEVER runs because metadata registration fails first

## ✅ FIXES APPLIED

### 1. Server-Side (`core.ts`)
- Callback now returns `undefined` immediately (no blocking)
- UploadThing doesn't wait for callback response
- Media registration happens in background (fire-and-forget with retry)
- Added proper error handling and logging

### 2. Client-Side (`useMediaUpload.ts`)
- All media registration now happens CLIENT-SIDE after upload completes
- Client registers media using `uploadMedia()` API call
- Proper error handling and UI feedback
- Timeout detection (60s) prevents UI from getting stuck

### 3. Flow After Fix
1. File uploads to UploadThing ✅
2. UploadThing completes metadata registration ✅ (no longer waits)
3. Client receives upload completion ✅
4. Client registers media in database ✅
5. UI shows "Uploaded" ✅

## 🎯 WHAT WAS FIXED

1. ✅ Callback returns nothing - UploadThing doesn't wait
2. ✅ Media registration handled client-side - no server dependency
3. ✅ Client-side timeout detection - UI won't get stuck
4. ✅ Proper error handling - clear feedback for users
5. ✅ React setState during render fixed - all toasts deferred

## 📝 IMPORTANT NOTES

- The timeout was caused by localhost callback URL being unreachable
- Media registration now happens AFTER upload, not during
- Both images and videos follow the same flow
- Project media uploads use the same pattern
