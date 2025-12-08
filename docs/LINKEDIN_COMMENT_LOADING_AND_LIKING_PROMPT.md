# LinkedIn-Style Comment Loading & Liking System - Implementation Guide

## Overview
This document describes the exact requirements for implementing LinkedIn-style comment loading behavior and fixing comment/reply liking functionality. The current implementation requires clicking the comment icon to see comments, but LinkedIn shows comments directly on posts with progressive loading.

## Key Requirements

### 1. **LinkedIn-Style Comment Display (Default Behavior)**

#### Current Behavior (WRONG):
- Comments are hidden by default
- User must click comment icon to see any comments
- All comments load at once when comment section opens

#### Required Behavior (LinkedIn-style):
- **Show 1 comment by default** on each post (without clicking anything)
- Display the first/most recent comment directly under the post
- Show "Load more comments" button if there are more than 1 comment
- Only load additional comments when user clicks "Load more comments"
- Comment section should be visible immediately on page load

### 2. **Visual Structure (Based on LinkedIn Screenshots)**

```
┌─────────────────────────────────────┐
│ Post Content                        │
│ [Image/Text]                        │
├─────────────────────────────────────┤
│ [Like] [Comment] [Repost] [Send]   │
│ X likes • Y comments • Z shares     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ First Comment (Always Visible)  │ │
│ │ User Avatar | Name | Time       │ │
│ │ Comment content...              │ │
│ │ Like | Reply                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [Load more comments] ← Only if >1   │
└─────────────────────────────────────┘
```

### 3. **Comment Loading Logic**

#### Backend API Requirements:

**New Endpoint or Modified Endpoint:**
- Create endpoint: `GET /posts/:postId/comments/preview` OR modify existing to support `limit=1` parameter
- Returns: First comment with its replies (if any)
- Response structure:
```typescript
{
  success: true,
  data: {
    comment: Comment | null,  // First comment or null
    totalCount: number,        // Total comments on post
    hasMore: boolean          // true if totalCount > 1
  }
}
```

**OR modify existing endpoint:**
- `GET /posts/:postId/comments?limit=1&offset=0`
- Returns first comment with pagination info

#### Frontend Implementation:

**In `PostIntract.tsx` or `PostCard.tsx`:**

1. **Add Preview Comment Query:**
```typescript
// New hook: useCommentPreviewQuery
const { data: previewData } = useCommentPreviewQuery(postId);

// previewData structure:
// {
//   comment: Comment | null,
//   totalCount: number,
//   hasMore: boolean
// }
```

2. **Display First Comment:**
- Show first comment directly under post engagement buttons
- No need to click comment icon to see it
- Display format matches LinkedIn (avatar, name, content, like/reply buttons)

3. **"Load more comments" Button:**
- Show only if `hasMore === true` (i.e., `totalCount > 1`)
- When clicked, either:
  - Option A: Expand to show full `CommentSection` component
  - Option B: Load next batch of comments (e.g., 5-10 more) and append
  - **Recommended: Option A** (matches LinkedIn behavior)

4. **Comment Icon Behavior:**
- Clicking comment icon should:
  - If preview is shown: Expand to full comment section
  - If not shown: Show full comment section
  - Toggle comment section visibility

### 4. **Comment Liking Fix**

#### Current Issues:
- Comment likes are not working correctly
- Error occurs when clicking like on comments/replies
- Need to verify API endpoint, authentication, and cache updates

#### Required Fixes:

**Backend (`post-service`):**

1. **Verify Like Service (`like.service.ts`):**
   - Ensure `likeComment(commentId, userId)` works correctly
   - Check that it creates/updates `Reaction` record with `commentId`
   - Verify `targetType` is set to `COMMENT`
   - Ensure `deletedAt` is handled correctly (soft delete for unlike)

2. **Verify Like Controller (`like.controller.ts`):**
   - Check `likeComment()` method
   - Ensure it extracts `userId` from request correctly
   - Verify response format matches frontend expectations

3. **Check Database:**
   - Verify `Reaction` model has correct indexes
   - Ensure `commentId` foreign key is working
   - Check unique constraint: `@@unique([commentId, userId, type])`

**Frontend (`client`):**

1. **Fix `useCommentLikeMutation.ts`:**
   - Verify query keys match actual query keys used in `useCommentsInfiniteQuery`
   - Current query key: `["engagement", "comments"]` might not match
   - Should use: `queryKeys.engagement.comments.all(postId)` or similar
   - Fix cache update to match actual query structure

2. **Check API Service (`engagement.service.ts`):**
   - Verify `likeComment()` and `unlikeComment()` endpoints are correct
   - Check authentication headers are being sent
   - Verify request format matches backend expectations

3. **Update Cache Logic:**
   - The mutation should update the correct query cache
   - For preview comments, update preview query cache
   - For full comment section, update infinite query cache
   - Ensure both are updated when liking/unliking

### 5. **Implementation Checklist**

#### Backend Changes:

- [ ] **Create or Modify Comment Preview Endpoint:**
  - [ ] Add `GET /posts/:postId/comments/preview` endpoint
  - [ ] OR modify `GET /posts/:postId/comments` to support `limit=1` for preview
  - [ ] Return first comment with `totalCount` and `hasMore` flag
  - [ ] Include user data, likes, and replies (if any) for the first comment

- [ ] **Fix Comment Like Service:**
  - [ ] Verify `likeComment()` creates `Reaction` with correct `commentId`
  - [ ] Verify `unlikeComment()` soft-deletes `Reaction` (sets `deletedAt`)
  - [ ] Ensure `incrementLikesCount()` and `decrementLikesCount()` are called
  - [ ] Check error handling for duplicate likes

- [ ] **Fix Comment Like Controller:**
  - [ ] Verify `userId` extraction from request
  - [ ] Verify response format: `{ success: true, message: "..." }`
  - [ ] Add proper error handling

#### Frontend Changes:

- [ ] **Create Comment Preview Component:**
  - [ ] Create `CommentPreview.tsx` component
  - [ ] Display first comment with LinkedIn-style formatting
  - [ ] Show "Load more comments" button if `hasMore === true`
  - [ ] Handle click to expand to full comment section

- [ ] **Update `PostIntract.tsx`:**
  - [ ] Add preview comment query hook
  - [ ] Display `CommentPreview` component below engagement buttons
  - [ ] Update comment icon click behavior to toggle full comment section
  - [ ] Pass `postAuthorId` to comment components for Author badge

- [ ] **Update `PostCard.tsx`:**
  - [ ] Pass `post.userId` as `postAuthorId` to `PostIntract`
  - [ ] Ensure post author ID is available

- [ ] **Fix `useCommentLikeMutation.ts`:**
  - [ ] Fix query keys to match actual comment query keys
  - [ ] Update cache for both preview and full comment queries
  - [ ] Verify optimistic updates work for both preview and full views
  - [ ] Test error handling and rollback

- [ ] **Create `useCommentPreviewQuery.ts`:**
  - [ ] New query hook for fetching first comment
  - [ ] Uses `GET /posts/:postId/comments?limit=1` or preview endpoint
  - [ ] Returns `{ comment, totalCount, hasMore }`

- [ ] **Update `CommentSection.tsx`:**
  - [ ] Ensure it works when expanded from preview
  - [ ] Maintain state when toggling between preview and full view
  - [ ] Pass `postAuthorId` to all comment components

### 6. **API Endpoint Specifications**

#### Comment Preview Endpoint:

**Request:**
```
GET /api/v1/engagement/posts/:postId/comments?limit=1&offset=0
```

**Response:**
```typescript
{
  success: true,
  data: [
    {
      id: "comment1",
      content: "First comment text",
      userId: "user1",
      postId: "post1",
      parentCommentId: null,
      likesCount: 5,
      isLiked: false,
      createdAt: "2025-01-15T10:00:00Z",
      user: {
        id: "user1",
        name: "John Doe",
        username: "johndoe",
        avatar: "avatar.jpg"
      },
      replies: [
        // First 2-3 replies if any
      ],
      repliesCount: 3
    }
  ],
  pagination: {
    limit: 1,
    offset: 0,
    count: 1,
    total: 15  // Total comments on post
  }
}
```

**OR New Preview Endpoint:**

**Request:**
```
GET /api/v1/engagement/posts/:postId/comments/preview
```

**Response:**
```typescript
{
  success: true,
  data: {
    comment: {
      // First comment object (same structure as above)
    } | null,
    totalCount: 15,
    hasMore: true
  }
}
```

#### Comment Like Endpoint (Verify):

**Request:**
```
POST /api/v1/engagement/comments/:commentId/likes
Headers: { Authorization: "Bearer <token>" }
Body: {} (empty)
```

**Response:**
```typescript
{
  success: true,
  message: "Comment liked successfully"
}
```

**Unlike Request:**
```
DELETE /api/v1/engagement/comments/:commentId/likes
Headers: { Authorization: "Bearer <token>" }
```

**Response:**
```typescript
{
  success: true,
  message: "Comment unliked successfully"
}
```

### 7. **Component Structure**

```
PostCard
├── Post Content
├── PostIntract
│   ├── Engagement Stats (likes, comments, shares)
│   ├── Action Buttons (Like, Comment, Repost, Send)
│   ├── CommentPreview (NEW - shows first comment)
│   │   ├── First Comment Display
│   │   └── "Load more comments" Button (if hasMore)
│   └── CommentSection (shown when expanded or clicked)
│       ├── Comment Input
│       ├── All Comments List
│       └── "Load more comments" Button (pagination)
```

### 8. **Query Keys Structure**

```typescript
// Preview query
queryKeys.engagement.comments.preview(postId)

// Full comments query (infinite)
queryKeys.engagement.comments.all(postId)

// Comment likes
queryKeys.engagement.commentLikes.count(commentId)
queryKeys.engagement.commentLikes.status(commentId, userId)
```

### 9. **LinkedIn Behavior Reference**

Based on the provided LinkedIn screenshots:

1. **Default View:**
   - Post is displayed
   - Engagement buttons visible
   - **First comment is immediately visible** below engagement buttons
   - No need to click comment icon to see first comment

2. **Comment Display:**
   - Shows user avatar (small, e.g., 32px)
   - Shows user name and job title
   - Shows comment content
   - Shows "Like | Reply" buttons
   - Shows timestamp (e.g., "4h", "17h")

3. **"Load more comments" Button:**
   - Appears below first comment if there are more comments
   - Text: "Load more comments" or "View X more comments"
   - When clicked, expands to show all comments

4. **Comment Icon:**
   - Clicking comment icon opens full comment section
   - Shows all comments with pagination
   - Can be toggled to close

### 10. **Error Handling for Likes**

**Common Issues to Check:**

1. **Authentication:**
   - Verify `Authorization` header is sent
   - Check token is valid and not expired
   - Verify user ID is extracted correctly

2. **API Endpoint:**
   - Verify endpoint URL is correct
   - Check HTTP method (POST for like, DELETE for unlike)
   - Verify route parameters (`commentId`)

3. **Database:**
   - Check if `Reaction` record is created/updated
   - Verify unique constraint doesn't prevent duplicate likes
   - Check `deletedAt` handling for unlikes

4. **Cache Updates:**
   - Verify query keys match
   - Check optimistic updates are applied
   - Ensure rollback works on error

### 11. **Testing Checklist**

- [ ] First comment shows by default on posts with comments
- [ ] "Load more comments" button appears when `totalCount > 1`
- [ ] Clicking "Load more comments" expands to full comment section
- [ ] Comment icon toggles full comment section
- [ ] Liking a comment updates UI immediately (optimistic)
- [ ] Liking a comment persists after page refresh
- [ ] Unliking a comment works correctly
- [ ] Liking works for both main comments and replies
- [ ] Error handling works (shows error message, rolls back on failure)
- [ ] Author badge shows when post author comments/replies
- [ ] Reply functionality works correctly
- [ ] Comment count updates when new comments are added

### 12. **Code Examples**

#### Comment Preview Component:

```typescript
// CommentPreview.tsx
interface CommentPreviewProps {
  postId: string;
  postAuthorId?: string;
  onLoadMore: () => void;
}

export const CommentPreview: React.FC<CommentPreviewProps> = ({
  postId,
  postAuthorId,
  onLoadMore,
}) => {
  const { data, isLoading } = useCommentPreviewQuery(postId);
  
  if (isLoading) return <CommentPreviewSkeleton />;
  if (!data?.comment) return null;
  
  return (
    <div className="border-t border-gray-100 pt-3">
      <CommentItem
        comment={data.comment}
        postId={postId}
        postAuthorId={postAuthorId}
        isPreview={true}
      />
      {data.hasMore && (
        <button
          onClick={onLoadMore}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
        >
          Load more comments
        </button>
      )}
    </div>
  );
};
```

#### Updated PostIntract Component:

```typescript
// PostIntract.tsx
export const PostIntract: React.FC<PostIntractProps> = ({ post }) => {
  const [showFullComments, setShowFullComments] = useState(false);
  const { data: previewData } = useCommentPreviewQuery(post.id);
  
  const handleLoadMore = () => {
    setShowFullComments(true);
  };
  
  return (
    <>
      {/* Engagement buttons */}
      <div className="flex justify-between items-center">
        {/* Like, Comment, Repost, Send buttons */}
      </div>
      
      {/* Preview Comment (always visible if exists) */}
      {!showFullComments && previewData?.comment && (
        <CommentPreview
          postId={post.id}
          postAuthorId={post.userId}
          onLoadMore={handleLoadMore}
        />
      )}
      
      {/* Full Comment Section (when expanded) */}
      {showFullComments && (
        <CommentSection
          postId={post.id}
          postAuthorId={post.userId}
          onClose={() => setShowFullComments(false)}
        />
      )}
    </>
  );
};
```

#### Fixed Like Mutation:

```typescript
// useCommentLikeMutation.ts
export function useCommentLikeMutation() {
  const queryClient = useQueryClient();
  const authHeaders = useAuthHeaders();
  
  return useMutation({
    mutationFn: async ({ commentId, isLiked }) => {
      if (isLiked) {
        return await unlikeComment(commentId, authHeaders);
      } else {
        return await likeComment(commentId, authHeaders);
      }
    },
    onMutate: async ({ commentId, isLiked, postId }) => {
      // Cancel queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.engagement.comments.all(postId),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.engagement.comments.preview(postId),
      });
      
      // Update preview query
      queryClient.setQueryData(
        queryKeys.engagement.comments.preview(postId),
        (old: any) => {
          if (!old?.data?.comment) return old;
          if (old.data.comment.id === commentId) {
            return {
              ...old,
              data: {
                ...old.data,
                comment: {
                  ...old.data.comment,
                  likesCount: isLiked
                    ? Math.max(0, old.data.comment.likesCount - 1)
                    : old.data.comment.likesCount + 1,
                  isLiked: !isLiked,
                },
              },
            };
          }
          return old;
        }
      );
      
      // Update full comments query
      queryClient.setQueryData(
        queryKeys.engagement.comments.all(postId),
        (old: InfiniteData<CommentListResponse> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: updateCommentInTree(page.data, commentId, (comment) => ({
                ...comment,
                likesCount: isLiked
                  ? Math.max(0, comment.likesCount - 1)
                  : comment.likesCount + 1,
                isLiked: !isLiked,
              })),
            })),
          };
        }
      );
      
      return { postId };
    },
    onError: (error, variables, context) => {
      // Rollback logic
      if (context?.postId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.engagement.comments.all(context.postId),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.engagement.comments.preview(context.postId),
        });
      }
      toast.error("Failed to like comment. Please try again.");
    },
  });
}
```

---

## Summary

1. **Show first comment by default** on each post (LinkedIn-style)
2. **"Load more comments" button** appears when there are more comments
3. **Fix comment liking** - verify API, authentication, and cache updates
4. **Maintain all existing functionality** (replies, author badge, etc.)

This implementation will match LinkedIn's exact comment loading behavior and fix the liking functionality.

