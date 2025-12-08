# Complete LinkedIn Comment System Implementation - Master Prompt

## Overview
This is the complete implementation guide for building a LinkedIn-style comment system. It combines all requirements: flat two-level structure, default comment preview, progressive loading, and working like functionality.

---

## Part 1: Comment Structure (Two-Level Flat System)

### Key Principle
**Only 2 levels**: Main comments and flat replies. No nesting beyond replies.

### Database Schema
```prisma
model Comment {
  id              String  @id @default(uuid())
  postId          String
  userId          String
  content         String
  parentCommentId String?  // NULL for main comments, main comment ID for replies
  
  // CRITICAL: parentCommentId should ONLY reference main comments
  // Never allow parentCommentId to reference another reply
}
```

### Reply Behavior
- When replying to a **main comment**: `parentCommentId = main comment ID`
- When replying to a **reply**: Still use `parentCommentId = original main comment ID` (NOT the reply's ID)

### Backend Query Fix
**In `comment.repository.ts` - `getCommentsByPost()`:**

```typescript
// ❌ WRONG (Current - Recursive nesting):
include.Replies = {
  include: {
    Replies: {  // Nested replies - WRONG
      include: { Replies: { ... } }
    }
  }
};

// ✅ CORRECT (LinkedIn-style - Flat):
include.Replies = {
  where: { deletedAt: null },
  take: 10,
  orderBy: { createdAt: "asc" },
  include: {
    commentMentions: includeMentions,
    // NO nested Replies include
  },
};
```

---

## Part 2: Default Comment Preview (LinkedIn Behavior)

### Current Behavior (WRONG)
- Comments hidden by default
- Must click comment icon to see comments
- All comments load at once

### Required Behavior (LinkedIn-style)
- **Show 1 comment by default** on each post (no clicking required)
- Display first/most recent comment directly under engagement buttons
- Show **"Load more comments"** button if `totalCount > 1`
- Only load additional comments when clicking "Load more comments"
- Comment section visible immediately on page load

### Visual Structure
```
Post Content
├── Engagement Buttons (Like, Comment, Repost, Send)
├── Stats (X likes • Y comments • Z shares)
├── ┌─────────────────────────────────┐
│   │ First Comment (Always Visible)  │ ← NEW
│   │ Avatar | Name | Time            │
│   │ Comment content...              │
│   │ Like | Reply                     │
│   └─────────────────────────────────┘
│   [Load more comments] ← If hasMore
└── Full Comment Section (when expanded)
```

### Implementation Steps

#### Backend: Comment Preview Endpoint

**Option A: Modify Existing Endpoint**
```
GET /api/v1/engagement/posts/:postId/comments?limit=1&offset=0
```

**Option B: New Preview Endpoint**
```
GET /api/v1/engagement/posts/:postId/comments/preview
```

**Response:**
```typescript
{
  success: true,
  data: {
    comment: Comment | null,  // First comment
    totalCount: number,       // Total comments
    hasMore: boolean          // true if totalCount > 1
  }
}
```

#### Frontend: Comment Preview Component

**Create `CommentPreview.tsx`:**
```typescript
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

**Create `useCommentPreviewQuery.ts`:**
```typescript
export function useCommentPreviewQuery(postId: string) {
  const authHeaders = useAuthHeaders();
  
  return useQuery({
    queryKey: queryKeys.engagement.comments.preview(postId),
    queryFn: () => getCommentPreview(postId, authHeaders),
    enabled: !!postId && !!authHeaders.Authorization,
    staleTime: 30 * 1000,
  });
}
```

**Update `PostIntract.tsx`:**
```typescript
export const PostIntract: React.FC<PostIntractProps> = ({ post }) => {
  const [showFullComments, setShowFullComments] = useState(false);
  const { data: previewData } = useCommentPreviewQuery(post.id);
  
  const handleLoadMore = () => {
    setShowFullComments(true);
  };
  
  const handleCommentClick = () => {
    setShowFullComments(!showFullComments);
  };
  
  return (
    <>
      {/* Engagement buttons */}
      <div className="flex justify-between items-center">
        <SocialActionButton
          icon={Comment}
          count={engagement.commentsCount}
          onClick={handleCommentClick}
          isActive={showFullComments}
        />
        {/* Other buttons */}
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

---

## Part 3: Fix Comment Liking

### Issues to Fix
1. Comment likes not working
2. Error when clicking like on comments/replies
3. Cache not updating correctly

### Backend Fixes

#### 1. Verify Like Service (`like.service.ts`)

**Check `likeComment()` method:**
```typescript
async likeComment(commentId: string, userId: string): Promise<void> {
  // 1. Check if reaction already exists
  const existing = await prisma.reaction.findUnique({
    where: {
      commentId_userId_type: {
        commentId,
        userId,
        type: ReactionType.LIKE,
      },
    },
  });
  
  if (existing && !existing.deletedAt) {
    throw new Error("Comment already liked");
  }
  
  // 2. Create or update reaction
  await prisma.reaction.upsert({
    where: {
      commentId_userId_type: {
        commentId,
        userId,
        type: ReactionType.LIKE,
      },
    },
    create: {
      commentId,
      userId,
      type: ReactionType.LIKE,
      targetType: ReactionTargetType.COMMENT,
    },
    update: {
      deletedAt: null, // Restore if soft-deleted
    },
  });
  
  // 3. Increment likes count
  await this.commentRepository.incrementLikesCount(commentId);
}
```

**Check `unlikeComment()` method:**
```typescript
async unlikeComment(commentId: string, userId: string): Promise<void> {
  // 1. Find reaction
  const reaction = await prisma.reaction.findUnique({
    where: {
      commentId_userId_type: {
        commentId,
        userId,
        type: ReactionType.LIKE,
      },
    },
  });
  
  if (!reaction || reaction.deletedAt) {
    throw new Error("Comment not liked");
  }
  
  // 2. Soft delete
  await prisma.reaction.update({
    where: { id: reaction.id },
    data: { deletedAt: new Date() },
  });
  
  // 3. Decrement likes count
  await this.commentRepository.decrementLikesCount(commentId);
}
```

#### 2. Verify Like Controller (`like.controller.ts`)

```typescript
async likeComment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { commentId } = req.params;
    const userId = getUserIdFromRequest(req); // Verify this works
    
    if (!commentId) {
      throw new CustomError(HttpStatus.BAD_REQUEST, "Comment ID required");
    }
    
    if (!userId) {
      throw new CustomError(HttpStatus.UNAUTHORIZED, "User not authenticated");
    }
    
    await this._likeService.likeComment(commentId, userId);
    
    res.status(HttpStatus.CREATED).json({
      success: true,
      message: "Comment liked successfully",
    });
  } catch (error: any) {
    next(error);
  }
}
```

### Frontend Fixes

#### 1. Fix `useCommentLikeMutation.ts`

**Current Issues:**
- Query keys might not match actual query keys
- Cache updates might not work for preview comments
- Need to update both preview and full comment queries

**Fixed Version:**
```typescript
export function useCommentLikeMutation() {
  const queryClient = useQueryClient();
  const authHeaders = useAuthHeaders();
  
  // Helper to update comment in tree (for flat structure)
  const updateCommentInTree = (
    comments: Comment[],
    commentId: string,
    updateFn: (comment: Comment) => Comment
  ): Comment[] => {
    return comments.map((comment) => {
      if (comment.id === commentId) {
        return updateFn(comment);
      }
      // Update in replies (flat, not nested)
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: comment.replies.map((reply) =>
            reply.id === commentId ? updateFn(reply) : reply
          ),
        };
      }
      return comment;
    });
  };
  
  return useMutation({
    mutationFn: async ({
      commentId,
      isLiked,
      postId, // Add postId to variables
    }: {
      commentId: string;
      isLiked: boolean;
      postId: string;
    }) => {
      if (isLiked) {
        return await unlikeComment(commentId, authHeaders);
      } else {
        return await likeComment(commentId, authHeaders);
      }
    },
    onMutate: async ({ commentId, isLiked, postId }) => {
      // Cancel ongoing queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.engagement.comments.all(postId),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.engagement.comments.preview(postId),
      });
      
      // Snapshot for rollback
      const previousPreview = queryClient.getQueryData(
        queryKeys.engagement.comments.preview(postId)
      );
      const previousComments = queryClient.getQueriesData({
        queryKey: queryKeys.engagement.comments.all(postId),
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
          // Check replies in preview
          if (old.data.comment.replies) {
            const updatedReplies = old.data.comment.replies.map((reply: Comment) =>
              reply.id === commentId
                ? {
                    ...reply,
                    likesCount: isLiked
                      ? Math.max(0, reply.likesCount - 1)
                      : reply.likesCount + 1,
                    isLiked: !isLiked,
                  }
                : reply
            );
            return {
              ...old,
              data: {
                ...old.data,
                comment: {
                  ...old.data.comment,
                  replies: updatedReplies,
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
      
      return { previousPreview, previousComments, postId };
    },
    onError: (error, variables, context) => {
      // Rollback
      if (context?.postId) {
        if (context.previousPreview) {
          queryClient.setQueryData(
            queryKeys.engagement.comments.preview(context.postId),
            context.previousPreview
          );
        }
        if (context.previousComments) {
          context.previousComments.forEach(([queryKey, data]) => {
            queryClient.setQueryData(queryKey, data);
          });
        }
      }
      
      toast.error(
        variables.isLiked
          ? "Failed to unlike comment. Please try again."
          : "Failed to like comment. Please try again."
      );
    },
    onSuccess: (data, variables) => {
      // Invalidate to refetch fresh data
      queryClient.invalidateQueries({
        queryKey: queryKeys.engagement.comments.all(variables.postId),
        refetchType: "none",
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.engagement.comments.preview(variables.postId),
        refetchType: "none",
      });
    },
  });
}
```

#### 2. Update Comment Components to Pass postId

**In `CommentItem.tsx` and `ReplyItem.tsx`:**
```typescript
// When calling like mutation, pass postId
likeMutation.mutate({
  commentId: comment.id,
  isLiked: comment.isLiked || false,
  postId: postId, // Add this
});
```

#### 3. Verify API Service

**Check `engagement.service.ts`:**
```typescript
export const likeComment = async (
  commentId: string,
  headers: Record<string, string>
): Promise<LikeResponse> => {
  try {
    const res = await axiosInstance.post(
      API_ROUTES.ENGAGEMENT.LIKE_COMMENT(commentId),
      {}, // Empty body
      { headers }
    );
    return res.data;
  } catch (error: any) {
    console.error("Like comment error:", error);
    throw new Error(
      error.response?.data?.message || "Failed to like comment"
    );
  }
};
```

---

## Part 4: Author Badge Display

### Requirement
Show "Author" badge when post author comments or replies.

### Implementation

**In `CommentItem.tsx` and `ReplyItem.tsx`:**
```typescript
{postAuthorId && comment.userId === postAuthorId && (
  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 ml-1">
    Author
  </span>
)}
```

**Pass `postAuthorId` from `PostCard.tsx`:**
```typescript
<PostIntract 
  post={post} 
  postAuthorId={post.userId} // Add this
/>
```

---

## Part 5: Complete Implementation Checklist

### Backend (`post-service`)

- [ ] **Fix Comment Repository:**
  - [ ] Remove recursive `Replies.Replies` include
  - [ ] Ensure only direct replies are fetched
  - [ ] Add validation: replies can only reference main comments

- [ ] **Create Comment Preview Endpoint:**
  - [ ] Add `GET /posts/:postId/comments/preview` OR modify existing
  - [ ] Return first comment with `totalCount` and `hasMore`
  - [ ] Include user data, likes, and replies

- [ ] **Fix Comment Like Service:**
  - [ ] Verify `likeComment()` creates `Reaction` correctly
  - [ ] Verify `unlikeComment()` soft-deletes `Reaction`
  - [ ] Ensure `incrementLikesCount()` and `decrementLikesCount()` are called
  - [ ] Add proper error handling

- [ ] **Fix Comment Like Controller:**
  - [ ] Verify `userId` extraction
  - [ ] Verify response format
  - [ ] Add error handling

### Frontend (`client`)

- [ ] **Create Comment Preview:**
  - [ ] Create `CommentPreview.tsx` component
  - [ ] Create `useCommentPreviewQuery.ts` hook
  - [ ] Create `getCommentPreview()` API function

- [ ] **Update PostIntract:**
  - [ ] Add preview comment query
  - [ ] Display `CommentPreview` component
  - [ ] Update comment icon click behavior
  - [ ] Pass `postAuthorId` to components

- [ ] **Update PostCard:**
  - [ ] Pass `post.userId` as `postAuthorId` to `PostIntract`

- [ ] **Fix Comment Like Mutation:**
  - [ ] Add `postId` to mutation variables
  - [ ] Fix query keys to match actual queries
  - [ ] Update cache for both preview and full queries
  - [ ] Fix optimistic updates
  - [ ] Test error handling

- [ ] **Update Comment Components:**
  - [ ] Pass `postId` to like mutation calls
  - [ ] Ensure Author badge displays correctly
  - [ ] Remove nested reply rendering (if any)

- [ ] **Update Query Keys:**
  - [ ] Add `comments.preview(postId)` to query keys
  - [ ] Verify all query keys match

---

## Part 6: Testing

### Test Cases

1. **Comment Preview:**
   - [ ] First comment shows by default on posts with comments
   - [ ] "Load more comments" appears when `totalCount > 1`
   - [ ] Clicking "Load more comments" expands to full section
   - [ ] Comment icon toggles full comment section

2. **Comment Liking:**
   - [ ] Liking a comment updates UI immediately (optimistic)
   - [ ] Like persists after page refresh
   - [ ] Unliking works correctly
   - [ ] Liking works for main comments
   - [ ] Liking works for replies
   - [ ] Error handling works (shows error, rolls back)

3. **Comment Structure:**
   - [ ] Only 2 levels (main comments and flat replies)
   - [ ] No nested replies
   - [ ] Replies always reference main comment ID

4. **Author Badge:**
   - [ ] Shows when post author comments
   - [ ] Shows when post author replies
   - [ ] Doesn't show for other users

5. **Reply Functionality:**
   - [ ] Replying to main comment works
   - [ ] Replying to reply references main comment
   - [ ] Replies appear flat under main comment

---

## Summary

This complete implementation will:
1. ✅ Show first comment by default (LinkedIn-style)
2. ✅ Progressive loading with "Load more comments" button
3. ✅ Fix comment/reply liking functionality
4. ✅ Maintain flat two-level comment structure
5. ✅ Show Author badge when post author comments/replies
6. ✅ Match LinkedIn's exact behavior and UX

All code examples and implementation steps are provided above. Follow the checklist to implement systematically.

