# Post Edit Implementation Plan

## Goal
Reuse CreatePostModal for editing posts instead of having a separate EditPostModal.

## Files to Modify

1. **CreatePostModal.tsx**
   - Add optional `postToEdit?: NewPost` prop
   - Add useEffect to pre-fill form when editing
   - Create/use update mutation when editing
   - Change button text to "Save" when editing

2. **updatePost.ts** (NEW)
   - Create server action for updating posts
   - Use PATCH /feed/posts/:postId endpoint

3. **useUpdatePostMutation.ts** (NEW)
   - Create mutation hook for updating posts
   - Handle optimistic updates
   - Invalidate cache after update

4. **PostIntract.tsx**
   - Replace EditPostModal import with CreatePostModal
   - Pass post as postToEdit prop

5. **EditPostModal.tsx** (DELETE)
   - Remove this file after migration

## Implementation Steps

1. ✅ Create updatePost server action
2. ⏳ Modify CreatePostModal to support editing
3. ⏳ Create update mutation hook
4. ⏳ Update PostIntract to use CreatePostModal
5. ⏳ Remove EditPostModal

