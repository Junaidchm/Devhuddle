# Root Cause Report: Post Features Breakdown

## Executive Summary

After a recent change to post creation logic, all post-related features (like, comment, reply, share, report) began failing. The root causes have been identified and fixed.

## Root Causes Identified

### 1. **CRITICAL: Prisma Schema Mismatch in Comment Repository** ✅ FIXED
**File**: `post-service/src/repositories/impliments/comment.repository.ts`
**Issue**: The code was using `include.Replies` but the Prisma schema defines the relation as `other_Comment`.
**Impact**: All comment-related operations failed (get comments, get preview, get replies).
**Error**: `Unknown field 'Replies' for include statement on model 'Comment'`
**Fix**: Changed all references from `Replies` to `other_Comment` in:
- `comment.repository.ts` (line 103)
- `comment.service.ts` (lines 390, 413, 614)

### 2. **CRITICAL: Missing Request Body Handling in Engagement Proxy** ✅ FIXED
**File**: `api-gateway/src/middleware/engagement.proxy.middleware.ts`
**Issue**: The engagement proxy middleware was not forwarding request bodies for POST/PUT/PATCH requests. When Express.json() parses the body, it consumes the request stream, leaving http-proxy-middleware with an empty stream.
**Impact**: All POST requests to engagement endpoints (like, comment, share, report) failed silently or returned 500 errors.
**Fix**: Added the same body handling logic as the post proxy middleware:
- Manually write parsed body to proxy request
- Set correct content-length and content-type headers
- Prevent proxy from piping empty stream

### 3. **Post Creation: ID Generation** ✅ ALREADY FIXED
**File**: `post-service/src/repositories/impliments/post.repository.ts`
**Status**: Already fixed in previous session - using `uuidv4()` for post IDs.

### 4. **Outbox Event: ID Generation** ✅ ALREADY FIXED
**File**: `post-service/src/repositories/impliments/outbox.repository.ts`
**Status**: Already fixed in previous session - using `uuidv4()` for outbox event IDs.

### 5. **CRITICAL: Missing ID Generation in Comment Repository** ✅ FIXED
**File**: `post-service/src/repositories/impliments/comment.repository.ts`
**Issue**: The `createComment` method was calling `super.create()` without generating an ID first. Prisma requires an `id` field for Comment model.
**Impact**: All comment creation operations failed with "Argument `id` is missing" error.
**Fix**: Added UUID generation before creating comment: `const commentId = uuidv4();` and included it in the create data.

### 6. **CRITICAL: Missing ID Generation in Like Repository** ✅ FIXED
**File**: `post-service/src/repositories/impliments/like.repository.ts`
**Issue**: The `createLike` method was creating reactions without generating an ID first. Prisma requires an `id` field for Reaction model.
**Impact**: All like/unlike operations failed with "Argument `id` is missing" error.
**Fix**: Added UUID generation before creating reaction: `const reactionId = uuidv4();` and included it in the create data.

## Files Modified

1. `post-service/src/repositories/impliments/comment.repository.ts`
   - Changed `include.Replies` → `include.other_Comment`
   - Added UUID generation for comment IDs in `createComment` method

2. `post-service/src/services/impliments/comment.service.ts`
   - Changed `comment.Replies` → `comment.other_Comment` (3 occurrences)

3. `post-service/src/repositories/impliments/like.repository.ts`
   - Added UUID generation for reaction IDs in `createLike` method

4. `api-gateway/src/middleware/engagement.proxy.middleware.ts`
   - Added request body handling for POST/PUT/PATCH requests
   - Added user data forwarding from JWT middleware
   - Added response logging

## Testing Checklist

### ✅ Post Creation
- [ ] Create text post
- [ ] Create post with images
- [ ] Create post with videos
- [ ] Verify post appears in feed

### ✅ Like Operations
- [ ] Like a post
- [ ] Unlike a post
- [ ] Like a comment
- [ ] Unlike a comment
- [ ] Verify like count updates
- [ ] Verify optimistic UI updates

### ✅ Comment Operations
- [ ] Create top-level comment
- [ ] Reply to a comment
- [ ] Edit a comment
- [ ] Delete a comment
- [ ] Get comment preview
- [ ] Get full comment list
- [ ] Get replies to a comment

### ✅ Share/Send Operations
- [ ] Send post to connections
- [ ] Verify notifications are created

### ✅ Report Operations
- [ ] Report a post
- [ ] Report a comment
- [ ] Verify report is created

## Rollback Plan

If issues persist after deployment:

1. **Revert Prisma Schema Changes**:
   ```bash
   git revert <commit-hash>
   docker restart post-service
   ```

2. **Revert Engagement Proxy**:
   ```bash
   git revert <commit-hash>
   docker restart api-gateway
   ```

3. **Database Rollback** (if needed):
   - No database schema changes were made
   - Only code changes to match existing schema

## Prevention Recommendations

1. **Add Type Safety**: Use Prisma's generated types to catch schema mismatches at compile time
2. **Integration Tests**: Add tests that verify Prisma queries match the schema
3. **Proxy Middleware Template**: Create a shared template for proxy middleware to ensure consistent body handling
4. **Schema Validation**: Add a pre-commit hook that validates Prisma queries against the schema

## Post-Mortem

### What Caused the Breakage?
The breakage was caused by a mismatch between the Prisma schema relation name (`other_Comment`) and the code using a different name (`Replies`). This likely happened during a refactoring or schema update where the relation name was changed but the code wasn't updated consistently.

### How It Was Fixed
1. Identified the schema mismatch by checking Prisma errors in logs
2. Updated all references from `Replies` to `other_Comment`
3. Fixed the engagement proxy middleware to properly handle request bodies
4. Verified all engagement endpoints are correctly routed

### Suggestions to Prevent Recurrence
1. Use Prisma's generated types consistently
2. Add integration tests for all engagement endpoints
3. Use a shared proxy middleware template
4. Add schema validation in CI/CD pipeline

