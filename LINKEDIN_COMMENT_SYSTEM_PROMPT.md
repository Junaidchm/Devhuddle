# LinkedIn-Style Comment System Implementation Guide

## Overview
This document describes the exact requirements for implementing a LinkedIn-style comment system. The current implementation incorrectly uses nested/recursive comment structures. LinkedIn, Facebook, and YouTube use a **flat, two-level comment system** instead.

## Key Principles

### 1. **Two-Level Structure Only**
- **Level 1: Main Comments** - Direct comments on the post (parentCommentId = null)
- **Level 2: Replies** - All replies to a main comment are flat under that comment (parentCommentId = main comment ID)
- **NO NESTING BEYOND 2 LEVELS** - Replies cannot have replies. If someone wants to reply to a reply, they are replying to the original main comment.

### 2. **Reply Behavior**
When a user clicks "Reply" on a comment:
- If replying to a **main comment**: Create a reply with `parentCommentId = main comment ID`
- If replying to a **reply**: Still create a reply with `parentCommentId = original main comment ID` (NOT the reply's ID)
- The reply should reference the original commenter's name in the display (e.g., "John Doe Thank you!")

### 3. **Database Schema Requirements**

The current schema is mostly correct, but the query logic needs to change:

```prisma
model Comment {
  id              String  @id @default(uuid())
  postId          String
  userId          String
  content         String
  parentCommentId String?  // NULL for main comments, main comment ID for replies
  
  // ... other fields
}
```

**Important**: 
- `parentCommentId` should ONLY reference main comments (top-level comments)
- Never allow `parentCommentId` to reference another reply
- All replies are direct children of main comments

### 4. **Data Fetching Logic**

#### Backend Changes Required:

**In `comment.repository.ts` - `getCommentsByPost()` method:**

**CURRENT (WRONG):**
```typescript
include.Replies = {
  where: { deletedAt: null },
  take: 5,
  orderBy: { createdAt: "asc" },
  include: {
    // ❌ WRONG: Recursively including replies to replies
    Replies: {
      where: { deletedAt: null },
      take: 5,
      orderBy: { createdAt: "asc" },
      include: { commentMentions: includeMentions }
    },
    commentMentions: includeMentions,
  },
};
```

**CORRECT (LinkedIn-style):**
```typescript
include.Replies = {
  where: { 
    deletedAt: null,
    // ✅ CRITICAL: Only get direct replies to this main comment
    // Ensure parentCommentId equals the main comment's ID
  },
  take: 10, // Can show more replies
  orderBy: { createdAt: "asc" },
  include: {
    commentMentions: includeMentions,
    // ✅ NO nested Replies include - replies don't have replies
  },
};
```

**When creating a reply:**
- If user clicks "Reply" on a main comment: `parentCommentId = main comment ID`
- If user clicks "Reply" on a reply: `parentCommentId = original main comment ID` (not the reply's ID)

### 5. **Frontend Display Requirements**

#### Visual Structure:

```
┌─────────────────────────────────────┐
│ Main Comment 1                      │
│ └─ Reply 1 to Main Comment 1        │
│ └─ Reply 2 to Main Comment 1        │
│ └─ Reply 3 to Main Comment 1        │
├─────────────────────────────────────┤
│ Main Comment 2                      │
│ └─ Reply 1 to Main Comment 2        │
│ └─ Reply 2 to Main Comment 2        │
└─────────────────────────────────────┘
```

**NOT:**
```
❌ Main Comment
   └─ Reply 1
      └─ Reply to Reply 1  (WRONG - no nesting)
         └─ Reply to Reply to Reply (WRONG)
```

#### UI Components:

1. **Main Comment Display:**
   - User avatar, name, timestamp
   - Comment content
   - Like button with count
   - Reply button
   - Edit/Delete menu (if owner)
   - **"View X replies"** button if replies exist (initially show 2-3 replies, expand to show all)

2. **Reply Display:**
   - Smaller avatar (e.g., 24px vs 32px for main comment)
   - Indented slightly (e.g., `ml-8` or `ml-12`)
   - User name, timestamp
   - **If replying to a specific user, show: "@OriginalCommenterName Thank you!"**
   - Like button with count
   - Reply button (which replies to the MAIN comment, not this reply)
   - Edit/Delete menu (if owner)
   - **Author Badge**: Show "Author" badge if the reply is from the post author

3. **Author Badge Display:**
   - When the post author replies to any comment, show an "Author" badge next to their name
   - Badge should be visible and styled (e.g., blue background, white text, rounded)
   - Check: `reply.userId === post.userId` to determine if author

### 6. **Reply Input Behavior**

When clicking "Reply" on:
- **Main Comment**: Input appears with placeholder "Reply to [Main Commenter Name]..."
- **Existing Reply**: Input appears with placeholder "Reply to [Original Main Commenter Name]..." (NOT the reply author's name)

When submitting a reply:
- Always set `parentCommentId` to the **main comment's ID** (never to a reply's ID)
- Optionally store `repliedToUserId` to track who was being replied to (for display purposes)

### 7. **Comment Count Logic**

- **Main comment count**: Count only top-level comments (parentCommentId = null)
- **Reply count per comment**: Count all replies where parentCommentId = main comment ID
- **Total comment count on post**: Count all comments (main + replies) for the post

### 8. **API Response Structure**

**Current (WRONG):**
```typescript
{
  id: "comment1",
  content: "Main comment",
  replies: [
    {
      id: "reply1",
      content: "Reply",
      replies: [  // ❌ WRONG: Nested replies
        { id: "nested1", content: "Nested reply" }
      ]
    }
  ]
}
```

**Correct (LinkedIn-style):**
```typescript
{
  id: "comment1",
  content: "Main comment",
  userId: "user1",
  user: { id: "user1", name: "John Doe", ... },
  replies: [  // ✅ All replies are flat, same level
    { 
      id: "reply1", 
      content: "Reply to John",
      userId: "user2",
      parentCommentId: "comment1",  // Always points to main comment
      user: { id: "user2", name: "Jane Smith", ... },
      isAuthor: false  // Whether this reply is from post author
    },
    { 
      id: "reply2", 
      content: "Another reply",
      userId: "user3",
      parentCommentId: "comment1",  // Same parent
      user: { id: "user3", name: "Post Author", ... },
      isAuthor: true  // Post author replied
    }
  ],
  repliesCount: 2
}
```

### 9. **Implementation Checklist**

#### Backend (`post-service`):

- [ ] **Repository Layer** (`comment.repository.ts`):
  - [ ] Remove recursive `Replies.Replies` include from `getCommentsByPost()`
  - [ ] Ensure `getReplies()` only fetches direct replies to a main comment
  - [ ] Add validation: When creating a reply, if `parentCommentId` is provided, verify it's a main comment (not another reply)

- [ ] **Service Layer** (`comment.service.ts`):
  - [ ] Modify `createComment()` to ensure replies always reference main comments
  - [ ] When `parentCommentId` is provided, check if it's a main comment. If it's a reply, find its parent and use that instead
  - [ ] Include `isAuthor` flag in comment responses (check if `comment.userId === post.userId`)
  - [ ] Include post author ID in comment responses for frontend to check

- [ ] **Controller Layer** (`comment.controller.ts`):
  - [ ] Ensure API responses include post author information
  - [ ] Include `isAuthor` boolean in each comment/reply object

#### Frontend (`client`):

- [ ] **CommentSection.tsx**:
  - [ ] Remove recursive `ReplyItem` component nesting
  - [ ] Display all replies flat under their main comment
  - [ ] Show "Author" badge when `reply.userId === post.userId`
  - [ ] Update reply input to always reference main comment ID
  - [ ] Update "View replies" button to show/hide all replies (not nested)
  - [ ] Remove nested reply rendering logic (lines 364-375)

- [ ] **ReplyItem Component**:
  - [ ] Remove nested replies rendering
  - [ ] Update reply button to reply to main comment, not the reply itself
  - [ ] Display author badge when applicable
  - [ ] Show original commenter's name when replying (e.g., "John Doe Thank you!")

- [ ] **Types** (`feed.ts`):
  - [ ] Update `Comment` interface to include `isAuthor?: boolean`
  - [ ] Ensure `replies` array doesn't have nested `replies` property
  - [ ] Add `postAuthorId` to comment context if needed

### 10. **Visual Reference from LinkedIn**

Based on the provided LinkedIn screenshots:

1. **Main Comment Structure:**
   - Large profile picture (e.g., 40px)
   - User name, connection level, job title
   - Comment content in gray background box
   - Timestamp (e.g., "4h", "17h")
   - Like and Reply buttons below

2. **Reply Structure:**
   - Smaller profile picture (e.g., 24-32px)
   - Indented from left margin
   - User name, connection level, job title
   - **Author badge** visible when post author replies (blue "Author" badge)
   - Reply content in lighter gray background
   - Timestamp
   - Like and Reply buttons
   - **When replying, shows original commenter's name**: "Nandana K Thankyou😊"

3. **Reply Input:**
   - Appears below the comment/reply being replied to
   - Placeholder: "Reply to [Name]..."
   - Submit button

4. **View Replies Button:**
   - Shows "View X replies" or "Load more comments"
   - Expands to show all replies flat (no nesting)

### 11. **Critical Rules Summary**

1. ✅ **Only 2 levels**: Main comments and replies (flat)
2. ✅ **Replies always reference main comment ID** (never another reply's ID)
3. ✅ **No recursive nesting** in database queries or frontend rendering
4. ✅ **Author badge** shown when post author replies
5. ✅ **Reply display** shows original commenter's name when applicable
6. ✅ **Flat structure** - all replies to a comment are siblings, not nested

### 12. **Example Flow**

**Scenario**: User A posts. User B comments. User C replies to User B's comment. User D wants to reply to User C's reply.

**Current (WRONG) Implementation:**
```
Post
└─ Comment by User B (parentCommentId: null)
   └─ Reply by User C (parentCommentId: User B's comment ID)
      └─ Reply by User D (parentCommentId: User C's reply ID) ❌ WRONG
```

**Correct (LinkedIn-style) Implementation:**
```
Post
└─ Comment by User B (parentCommentId: null)
   ├─ Reply by User C (parentCommentId: User B's comment ID) ✅
   └─ Reply by User D (parentCommentId: User B's comment ID) ✅
      // User D is replying to the conversation, not nesting deeper
```

When User D clicks "Reply" on User C's reply:
- The UI should show "Reply to User B..." (original commenter)
- The `parentCommentId` should be User B's comment ID
- The reply can optionally mention User C in the content: "@UserC [message]"

---

## Implementation Priority

1. **Backend First**: Fix repository and service to prevent nested replies
2. **Frontend Second**: Update UI to display flat structure
3. **Author Badge**: Add post author detection and badge display
4. **Reply Logic**: Ensure replies always reference main comments

This system matches LinkedIn, Facebook, and YouTube's comment architecture - simple, flat, and user-friendly.

