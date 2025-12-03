# Post Creation System - Critical Bug Fix Prompt

## 🐛 REPORTED BUGS

### Bug #1: Posts with Media Not Persisting
**Symptom**: Posts with images/videos show optimistically but disappear on page reload
**Working**: Text-only posts persist correctly
**Impact**: CRITICAL - Core functionality broken

### Bug #2: Image Editor Modal Not Opening
**Symptom**: Clicking image icon doesn't open photo editor, only video editor opens
**Expected**: Image icon should open PhotoEditorModal, video icon should open VideoEditorModal
**Location**: `CreatePostModal.tsx` - Image/Video button handlers

### Bug #3: Video Upload Not Implemented
**Symptom**: Video uploading functionality incomplete
**Expected**: Full video upload with proper handling
**Impact**: Missing feature

---

## 🔍 INVESTIGATION REQUIRED

### Issue Analysis Checklist

1. **Post Creation Flow with Media**
   - [ ] Verify mediaIds are being extracted correctly from media array
   - [ ] Check if mediaIds are being sent to server action
   - [ ] Verify server action receives and validates mediaIds
   - [ ] Check if backend correctly processes mediaIds
   - [ ] Verify transaction includes media attachment
   - [ ] Check if mutation properly invalidates cache after success
   - [ ] Verify query key mismatch (mutation uses different keys in onMutate vs onSuccess)

2. **Image Editor Modal Issue**
   - [ ] Check image button onClick handler
   - [ ] Check video button onClick handler  
   - [ ] Verify modal state management (showPhotoEditor vs showVideoEditor)
   - [ ] Check if both buttons are wired correctly

3. **Video Upload Implementation**
   - [ ] Check if video upload hook exists
   - [ ] Verify video file handling
   - [ ] Check video editor component
   - [ ] Verify video upload to UploadThing
   - [ ] Check video processing pipeline

---

## 🎯 SPECIFIC CODE ISSUES TO INVESTIGATE

### Issue 1: Mutation Function Signature Mismatch

**Problem Location**: 
- `client/src/components/feed/mutations/useSubmitPostMutation.ts`
- `client/src/components/feed/feedEditor/actions/submitPost.ts`
- `client/src/components/feed/feedEditor/CreatePostModal.tsx`

**Issue**: 
- `mutation.mutate()` is called with `NewPost` object containing full post data
- But `submitPost` server action expects `{ content, mediaIds, visibility, commentControl }`
- Mismatch between what's passed and what's expected

**Current Flow**:
```typescript
// CreatePostModal.tsx - Line 135
mutation.mutate(newPostProps); // Passes NewPost with full data

// submitPost.ts - Line 9
export async function submitPost(input: {
  content: string;
  mediaIds: string[];
  visibility?: string;
  commentControl?: string;
}) // Expects simple object

// useSubmitPostMutation.ts - Line 45
mutationFn: submitPost, // Calls submitPost with newPostProps (wrong shape!)
```

**Fix Needed**: Pass only required fields to submitPost

---

### Issue 2: Query Key Mismatch in Mutation

**Problem Location**: `useSubmitPostMutation.ts`

**Issue**:
- Line 50: Uses `["post-feed", "for-you"]` for optimistic update
- Line 88: Uses `["feed", "for-you"]` for error rollback  
- Line 99: Uses `["feed", "for-you"]` for success invalidation
- Inconsistent query keys = cache not properly invalidated

**Fix Needed**: Use consistent query key throughout

---

### Issue 3: Image Button Handler Missing/Incorrect

**Problem Location**: `CreatePostModal.tsx`

**Issue**:
- Line 278: Video button has commented out onClick
- Line 268-271: Image button opens photo editor (correct)
- Line 292: Poll button ALSO opens photo editor (wrong!)
- No video editor button handler

**Fix Needed**: 
- Wire video button to open video editor
- Fix poll button to open poll modal
- Ensure image button opens photo editor

---

### Issue 4: Media IDs Extraction

**Problem Location**: `CreatePostModal.tsx` Line 114

**Issue**:
- `media.map((a) => a.mediaId).filter(Boolean)` might not work correctly
- Need to verify media objects have mediaId after upload
- Need to verify mediaIds are not undefined/null

**Fix Needed**: Add validation and logging

---

### Issue 5: Server Action Error Handling

**Problem Location**: `submitPost.ts`

**Issue**:
- Returns error object but mutation might not handle it correctly
- Error response structure doesn't match mutation's error handling
- Silent failures possible

**Fix Needed**: Proper error propagation

---

## 🛠️ IMPLEMENTATION REQUIREMENTS

### Fix #1: Correct Mutation Function Signature
- Update CreatePostModal to pass only required fields
- Ensure mediaIds array is properly extracted and validated
- Add error handling for missing mediaIds

### Fix #2: Fix Query Key Consistency
- Use same query key in onMutate, onError, and onSuccess
- Verify query key matches feed query key
- Properly invalidate cache after successful post creation

### Fix #3: Fix Image/Video Button Handlers
- Image button → opens PhotoEditorModal
- Video button → opens VideoEditorModal  
- Poll button → opens PollModal
- Verify all modals work correctly

### Fix #4: Complete Video Upload Implementation
- Implement video upload hook similar to image upload
- Add video file validation
- Implement video editor modal functionality
- Add video preview and processing
- Ensure video uploads to UploadThing correctly

### Fix #5: Debug Media Persistence
- Add logging to track mediaIds through the flow
- Verify backend receives mediaIds
- Check database transaction for media attachment
- Verify cache invalidation after post creation
- Test post retrieval after creation

---

## 📋 DEBUGGING STEPS

1. **Add Console Logging (Temporary)**
   - Log mediaIds before mutation
   - Log payload sent to server action
   - Log server action response
   - Log mutation success/error

2. **Check Network Requests**
   - Verify POST /feed/submit includes mediaIds
   - Check response status and body
   - Verify gRPC call includes mediaIds

3. **Check Database**
   - Verify post is created in database
   - Check if media attachments are linked
   - Verify transaction completes

4. **Check Cache**
   - Verify optimistic update shows post
   - Check cache invalidation after success
   - Verify feed query refetches after invalidation

---

## ✅ EXPECTED BEHAVIOR AFTER FIX

1. **Image Upload Flow**:
   - Click image icon → PhotoEditorModal opens
   - Select images → Upload starts
   - Images upload → mediaIds received
   - Click Post → Post created with mediaIds
   - Post persists after reload

2. **Video Upload Flow**:
   - Click video icon → VideoEditorModal opens
   - Select video → Upload starts
   - Video uploads → mediaId received
   - Click Post → Post created with mediaId
   - Post persists after reload

3. **Text Post Flow**:
   - Type text → Click Post
   - Post created → Persists after reload

4. **Mixed Content**:
   - Add text + media → Click Post
   - Post created with both → Persists after reload

---

## 🔧 FILES TO MODIFY

### Priority 1 (Critical Bugs)
1. `client/src/components/feed/feedEditor/CreatePostModal.tsx`
   - Fix mutation payload (extract only required fields)
   - Fix image/video/poll button handlers
   - Add mediaIds validation

2. `client/src/components/feed/mutations/useSubmitPostMutation.ts`
   - Fix query key consistency
   - Improve error handling
   - Fix cache invalidation

3. `client/src/components/feed/feedEditor/actions/submitPost.ts`
   - Ensure proper error handling
   - Verify mediaIds are received

### Priority 2 (Video Upload)
4. `client/src/components/feed/feedEditor/VideoEdit.tsx`
   - Implement video upload functionality
   - Add video file handling
   - Add video preview

5. Video upload hook (if needed)
   - Create useVideoUpload hook
   - Similar to useMediaUpload but for videos

---

## 🎯 SUCCESS CRITERIA

- [ ] Image icon opens PhotoEditorModal
- [ ] Video icon opens VideoEditorModal
- [ ] Poll icon opens PollModal
- [ ] Posts with images persist after reload
- [ ] Posts with videos persist after reload
- [ ] Posts with text + media persist after reload
- [ ] Error messages are clear and helpful
- [ ] No console errors in browser
- [ ] Network requests succeed
- [ ] Database records are created correctly

---

**Ready to investigate and fix all issues systematically.**

