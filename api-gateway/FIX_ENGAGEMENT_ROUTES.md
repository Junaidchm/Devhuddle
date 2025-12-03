# Fixed: 404 Errors for Engagement Routes

## Problem
All requests to `/api/v1/engagement/posts/{postId}/comments/preview` were returning 404 errors.

## Root Cause
The engagement service proxy was **commented out** in the API gateway (`api-gateway/src/index.ts`), so all engagement routes were not being proxied to the post-service.

## Solution
1. **Uncommented the engagement service proxy** in `api-gateway/src/index.ts`
2. **Added validation** to the engagement proxy middleware (similar to project proxy) to handle missing `POST_SERVICE_URL`
3. **Improved error handling** with proper fallback middleware

## Changes Made

### 1. `api-gateway/src/index.ts`
**Before:**
```typescript
// // Engagement Service Routes (protected, JWT required)
// app.use(
//   ROUTES.ENGAGEMENT.BASE,
//   conditionalJwtMiddleware,
//   engagementServiceProxy
// );
```

**After:**
```typescript
// Engagement Service Routes (protected, JWT required)
app.use(
  ROUTES.ENGAGEMENT.BASE,
  conditionalJwtMiddleware,
  engagementServiceProxy
);
```

### 2. `api-gateway/src/middleware/engagement.proxy.middleware.ts`
- Added validation for `POST_SERVICE_URL`
- Added fallback middleware for when service is not configured
- Improved error messages

## How It Works

1. **Request comes in:** `/api/v1/engagement/posts/{postId}/comments/preview`
2. **API Gateway:** Routes to `engagementServiceProxy`
3. **Path Rewrite:** Removes `/api/v1/engagement` prefix, replaces with `/api/v1`
4. **Final path:** `/api/v1/posts/{postId}/comments/preview`
5. **Proxied to:** `POST_SERVICE_URL/api/v1/posts/{postId}/comments/preview`
6. **Post Service:** Handles the request via `engagementRouter`

## Route Mapping

| API Gateway Route | Path Rewrite | Post Service Route |
|-------------------|--------------|-------------------|
| `/api/v1/engagement/posts/:postId/comments/preview` | `/api/v1/engagement` → `/api/v1` | `/api/v1/posts/:postId/comments/preview` |
| `/api/v1/engagement/posts/:postId/likes` | `/api/v1/engagement` → `/api/v1` | `/api/v1/posts/:postId/likes` |
| `/api/v1/engagement/comments/:commentId/likes` | `/api/v1/engagement` → `/api/v1` | `/api/v1/comments/:commentId/likes` |

## Status
✅ Engagement routes are now properly proxied to post-service
✅ Comment preview endpoint should now work
✅ All engagement endpoints should be accessible

## Note on Profile Images
The 404 errors for `/profiles/...` images are a separate issue. Profile images should be served via presigned URLs from S3, not as static files. This is a frontend issue where image URLs need to be properly formatted to use presigned URLs.

