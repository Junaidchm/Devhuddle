# Production-Ready Post Features Implementation - Master Prompt

## Overview
This is the complete implementation guide for building LinkedIn/Facebook-level post features: reporting, sharing (internal + external), copy link, and post editing. This follows enterprise-grade engineering standards used by top social media platforms.

**Target**: Production-ready, scalable, enterprise-grade implementation  
**Stack**: Next.js 15 (App Router) + Microservices + PostgreSQL + Prisma + Redis + gRPC + Event-Driven Architecture

---

## 🎯 PHASE 1: COMPREHENSIVE ARCHITECTURE ANALYSIS

### Step 1: File Inspection Checklist

**BEFORE WRITING ANY CODE**, you must inspect and analyze ALL of these files:

#### Frontend (Next.js 15 - Client)
```
client/
├── src/
│   ├── components/
│   │   └── feed/
│   │       └── feedEditor/
│   │           ├── CreatePostModal.tsx          # Post creation UI
│   │           ├── PostIntract.tsx              # Engagement buttons
│   │           ├── CommentSection.tsx           # Comment system
│   │           └── [PostCard.tsx]               # Post display component
│   ├── app/
│   │   └── api/                                 # API routes if any
│   ├── hooks/
│   │   └── [post-related hooks]                 # Custom hooks
│   ├── lib/
│   │   └── api/                                 # API client functions
│   └── types/
│       └── [post types]                         # TypeScript types
```

#### Backend Microservices

**Post Service:**
```
post-service/
├── prisma/
│   └── schema.prisma                            # Database schema
├── protos/
│   ├── post.proto                               # gRPC definitions
│   └── user.proto                               # User service proto
├── src/
│   ├── controllers/
│   │   ├── impliments/
│   │   │   ├── feed.controller.ts               # Feed endpoints
│   │   │   ├── like.controller.ts               # Like handling
│   │   │   └── comment.controller.ts            # Comment handling
│   ├── services/
│   │   ├── impliments/
│   │   │   ├── post.service.ts                  # Post business logic
│   │   │   ├── like.service.ts                  # Like business logic
│   │   │   └── comment.service.ts               # Comment business logic
│   │   └── interfaces/
│   │       ├── IpostService.ts                  # Service interfaces
│   │       └── ICommentService.ts               # Comment interface
│   ├── repositories/
│   │   ├── impliments/
│   │   │   ├── post.repository.ts               # Post data access
│   │   │   ├── like.repository.ts               # Like data access
│   │   │   ├── comment.repository.ts            # Comment data access
│   │   │   └── share.repository.ts              # Share data access (if exists)
│   │   └── interface/
│   │       ├── IPostRepository.ts               # Repository interfaces
│   │       ├── ILikeRepository.ts
│   │       ├── ICommentRepository.ts
│   │       └── IShareRepository.ts
│   ├── routes/
│   │   └── engagement.routes.ts                 # API routes
│   ├── grpc-server.ts                           # gRPC server setup
│   └── utils/
│       ├── kafka.util.ts                        # Event publishing
│       └── grpc.retry.util.ts                   # gRPC retry logic
```

**API Gateway:**
```
api-gateway/
├── src/
│   ├── controllers/
│   │   └── feed/
│   │       └── main.feed.ts                     # Gateway endpoints
│   └── grpc/
│       └── generated/
│           └── post.ts                          # Generated gRPC clients
```

**Notification Service:**
```
notification-service/
├── prisma/
│   └── schema.prisma                            # Notification schema
├── src/
│   ├── consumers/
│   │   └── engagement.consumer.ts               # Event consumers
│   └── repositories/
│       └── impliments/
│           └── notifications.repository.ts       # Notification data access
```

**Auth Service:**
```
auth-service/
├── src/
│   ├── serviceDefinition/
│   │   └── userService.ts                       # User service
│   └── grpc/
│       └── generated/
│           └── user.ts                          # Generated types
```

#### Database Schemas
- `post-service/prisma/schema.prisma` - Post, Attachment, Like, Comment, Share models
- `notification-service/prisma/schema.prisma` - Notification models

#### Configuration Files
- `post-service/package.json` - Dependencies
- `client/package.json` - Frontend dependencies
- Any `.env.example` files

---

### Step 2: Architecture Analysis Requirements

After inspecting all files, provide:

#### 2.1 Current Architecture Assessment

**What to Document:**
1. **Data Flow**: How posts are created → stored → displayed
2. **Event Flow**: How notifications are triggered (Kafka events)
3. **gRPC Communication**: Service-to-service calls
4. **Cache Strategy**: Redis usage patterns
5. **Media Handling**: Upload flow (Uploadthing/presigned URLs)
6. **Error Handling**: Current retry/backoff patterns
7. **Transaction Management**: Database transaction usage
8. **Idempotency**: Current idempotency patterns

#### 2.2 Code Quality Audit

**Evaluate:**
- ✅ **What's Correct**: Well-structured code, good patterns
- ❌ **What's Wrong**: Anti-patterns, security issues, performance problems
- 🔧 **What Needs Restructuring**: Code that works but violates best practices

**Focus Areas:**
- Separation of concerns (Controller → Service → Repository)
- Business logic placement
- Error handling patterns
- Transaction boundaries
- Cache invalidation strategies
- Event publishing patterns
- gRPC error handling
- Rate limiting implementation
- Input validation
- Authorization checks

#### 2.3 Missing Industrial Standards

**Identify gaps in:**
- CQRS patterns (if needed)
- Event sourcing (if applicable)
- Background job processing
- Retry mechanisms with exponential backoff
- Circuit breakers
- Rate limiting
- Audit logging
- Monitoring hooks
- Health checks
- Graceful degradation

---

## 🏗️ PHASE 2: FEATURE DESIGN & ARCHITECTURE

### Feature 1: Post Reporting System

#### 1.1 Requirements (LinkedIn/Facebook Standard)

**User Actions:**
- User can report a post
- Reports are categorized (Spam, Harassment, False Information, Violence, etc.)
- Optional: Additional context/description
- Optional: Report specific comment within post

**System Behavior:**
- Reports trigger moderation workflow
- Rate limiting: Max 5 reports per user per day
- Idempotency: Same user can't report same post twice
- Async processing: Reports don't slow down feeds
- Escalation: Multiple reports trigger auto-review
- Visibility: Reported posts may be hidden pending review
- Soft removal: Posts hidden but not deleted
- Hard removal: Posts deleted after moderator approval
- Abuse detection: Flag users who report excessively
- Notifications: Alert moderators (optional)

#### 1.2 Data Model Design

```prisma
// post-service/prisma/schema.prisma

model PostReport {
  id            String   @id @default(uuid())
  postId        String
  reportedById  String   // User who reported
  category      ReportCategory
  description   String?  // Optional context
  status        ReportStatus @default(PENDING)
  severity      ReportSeverity @default(LOW)
  reviewedById  String?  // Moderator who reviewed
  reviewedAt    DateTime?
  resolution    String?  // Moderator notes
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  // Relations
  post          Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  reportedBy    User     @relation("UserReports", fields: [reportedById], references: [id])
  reviewedBy    User?    @relation("ModeratorReviews", fields: [reviewedById], references: [id])
  
  @@unique([postId, reportedById]) // Prevent duplicate reports
  @@index([postId])
  @@index([status])
  @@index([severity])
  @@index([createdAt])
}

enum ReportCategory {
  SPAM
  HARASSMENT
  FALSE_INFORMATION
  VIOLENCE
  HATE_SPEECH
  COPYRIGHT_VIOLATION
  SELF_HARM
  OTHER
}

enum ReportStatus {
  PENDING
  UNDER_REVIEW
  RESOLVED_APPROVED
  RESOLVED_REMOVED
  RESOLVED_IGNORED
}

enum ReportSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}

// Add to Post model
model Post {
  // ... existing fields
  reports       PostReport[]
  reportCount   Int      @default(0) // Denormalized count
  isHidden      Boolean  @default(false) // Hidden due to reports
  hiddenAt      DateTime?
  hiddenReason  String?
}
```

#### 1.3 API Design

**gRPC Service (post.proto):**
```protobuf
service PostService {
  // Report a post
  rpc ReportPost(ReportPostRequest) returns (ReportPostResponse);
  
  // Get reports (moderator only)
  rpc GetPostReports(GetPostReportsRequest) returns (GetPostReportsResponse);
  
  // Resolve report (moderator only)
  rpc ResolveReport(ResolveReportRequest) returns (ResolveReportResponse);
}

message ReportPostRequest {
  string post_id = 1;
  string user_id = 2;
  ReportCategory category = 3;
  optional string description = 4;
  string idempotency_key = 5; // Prevent duplicate submissions
}

message ReportPostResponse {
  bool success = 1;
  string report_id = 2;
  string message = 3;
}
```

**REST Endpoint (via API Gateway):**
```
POST /api/v1/posts/:postId/report
Body: {
  category: "SPAM" | "HARASSMENT" | ...,
  description?: string,
  idempotencyKey: string
}
```

#### 1.4 Implementation Architecture

**Flow:**
```
1. User clicks "Report" → Frontend sends request
2. API Gateway → Rate limit check (Redis)
3. API Gateway → gRPC call to post-service
4. Post Service:
   a. Validate idempotency key (Redis)
   b. Check duplicate report (DB)
   c. Create report record (DB transaction)
   d. Update post.reportCount (denormalized)
   e. Check escalation rules:
      - If reportCount >= 5 → Set severity HIGH
      - If reportCount >= 10 → Auto-hide post
   f. Publish event to Kafka: "post.reported"
5. Background Worker (moderation-service):
   a. Consume "post.reported" event
   b. Apply moderation rules
   c. Send notification to moderators (if needed)
   d. Update post visibility if needed
```

**Key Components:**

**Repository (`report.repository.ts`):**
```typescript
interface IReportRepository {
  createReport(data: CreateReportData): Promise<PostReport>;
  getReportById(id: string): Promise<PostReport | null>;
  getReportsByPost(postId: string, filters: ReportFilters): Promise<PostReport[]>;
  checkDuplicateReport(postId: string, userId: string): Promise<boolean>;
  updateReportStatus(id: string, status: ReportStatus, reviewedBy: string): Promise<PostReport>;
  getReportCountByPost(postId: string): Promise<number>;
}
```

**Service (`report.service.ts`):**
```typescript
interface IReportService {
  reportPost(data: ReportPostRequest): Promise<ReportPostResponse>;
  resolveReport(data: ResolveReportRequest): Promise<ResolveReportResponse>;
  checkEscalationRules(postId: string): Promise<void>;
  hidePostIfNeeded(postId: string): Promise<void>;
}
```

**Rate Limiting:**
- Use Redis with sliding window: `report:user:{userId}:count`
- Max 5 reports per 24 hours per user
- Use `SETEX` with TTL

**Idempotency:**
- Store idempotency key in Redis: `idempotency:report:{key}`
- TTL: 24 hours
- Return cached response if key exists

**Event Publishing:**
```typescript
// In report.service.ts
await kafkaProducer.send({
  topic: 'post.reported',
  messages: [{
    key: postId,
    value: JSON.stringify({
      postId,
      reportId,
      category,
      severity,
      reportCount: newCount,
      timestamp: new Date().toISOString()
    })
  }]
});
```

---

### Feature 2: Copy Post Link

#### 2.1 Requirements

**User Actions:**
- Click "Copy link" button on post
- Link copied to clipboard
- Link is shareable (respects privacy settings)

**Link Properties:**
- Canonical URL: `https://app.com/posts/{postId}`
- Shortened link (optional): `https://app.com/p/{shortId}`
- Share token: For private posts, generate time-limited token
- Analytics: Track link clicks
- Safe redirect: Handle deleted/private posts gracefully

#### 2.2 Data Model

```prisma
model PostShareLink {
  id            String   @id @default(uuid())
  postId        String
  shortId       String   @unique // For shortened URLs
  shareToken    String?  @unique // For private posts
  tokenExpiresAt DateTime? // Token expiration
  createdById   String   // User who generated link
  clickCount    Int      @default(0)
  createdAt     DateTime @default(now())
  
  post          Post     @relation(fields: [postId], references: [id])
  
  @@index([postId])
  @@index([shortId])
  @@index([shareToken])
}

// Add to Post model
model Post {
  // ... existing fields
  shareLinks    PostShareLink[]
  canonicalUrl  String? // Cached canonical URL
}
```

#### 2.3 API Design

**gRPC:**
```protobuf
rpc GetPostShareLink(GetPostShareLinkRequest) returns (GetPostShareLinkResponse);

message GetPostShareLinkRequest {
  string post_id = 1;
  string user_id = 2;
  bool generate_short = 3; // Generate shortened link
  bool is_private = 4; // Generate share token for private post
}

message GetPostShareLinkResponse {
  string canonical_url = 1;
  string short_url = 2; // If generated
  string share_token = 3; // If private
  int64 expires_at = 4; // Token expiration timestamp
}
```

**REST:**
```
GET /api/v1/posts/:postId/share-link
Response: {
  url: "https://app.com/posts/abc123",
  shortUrl: "https://app.com/p/xyz789",
  shareToken: "token123" // Only if private
}
```

**Link Resolution:**
```
GET /api/v1/posts/share/:shareToken
GET /api/v1/p/:shortId
→ Redirect to canonical post URL
→ Track analytics
```

#### 2.4 Implementation

**Service:**
```typescript
class ShareLinkService {
  async generateShareLink(postId: string, userId: string, options: ShareLinkOptions): Promise<ShareLink> {
    // 1. Check post visibility
    const post = await this.postRepository.getById(postId);
    if (!post) throw new Error('Post not found');
    
    // 2. Check privacy - can user share this?
    if (post.visibility === 'PRIVATE' && post.userId !== userId) {
      throw new Error('Cannot share private post');
    }
    
    // 3. Generate canonical URL
    const canonicalUrl = `${process.env.APP_URL}/posts/${postId}`;
    
    // 4. Generate short link if requested
    let shortUrl: string | null = null;
    if (options.generateShort) {
      const shortId = await this.generateShortId();
      await this.shareLinkRepository.create({
        postId,
        shortId,
        createdById: userId
      });
      shortUrl = `${process.env.APP_URL}/p/${shortId}`;
    }
    
    // 5. Generate share token for private posts
    let shareToken: string | null = null;
    let expiresAt: Date | null = null;
    if (post.visibility === 'PRIVATE' && options.isPrivate) {
      shareToken = crypto.randomBytes(32).toString('hex');
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      await this.shareLinkRepository.create({
        postId,
        shareToken,
        tokenExpiresAt: expiresAt,
        createdById: userId
      });
    }
    
    return { canonicalUrl, shortUrl, shareToken, expiresAt };
  }
  
  async resolveShareLink(tokenOrShortId: string): Promise<string> {
    const link = await this.shareLinkRepository.findByTokenOrShortId(tokenOrShortId);
    if (!link) throw new Error('Invalid link');
    
    // Check token expiration
    if (link.tokenExpiresAt && link.tokenExpiresAt < new Date()) {
      throw new Error('Link expired');
    }
    
    // Increment click count (async)
    this.trackLinkClick(link.id);
    
    return `/posts/${link.postId}`;
  }
  
  private async generateShortId(): Promise<string> {
    // Generate 8-character alphanumeric ID
    // Check for collisions
    let attempts = 0;
    while (attempts < 10) {
      const shortId = nanoid(8);
      const exists = await this.shareLinkRepository.findByShortId(shortId);
      if (!exists) return shortId;
      attempts++;
    }
    throw new Error('Failed to generate unique short ID');
  }
}
```

**Frontend:**
```typescript
// hooks/useCopyPostLink.ts
export function useCopyPostLink() {
  const copyLink = async (postId: string) => {
    const response = await fetch(`/api/v1/posts/${postId}/share-link`);
    const { url } = await response.json();
    
    await navigator.clipboard.writeText(url);
    toast.success('Link copied to clipboard');
  };
  
  return { copyLink };
}
```

---

### Feature 3: Internal Post Sharing

#### 3.1 Requirements (LinkedIn/Facebook Standard)

**Share Types:**
1. **Share to Feed**: Share post to your own feed with optional comment
2. **Share Privately**: Share post to another user (DM-like)
3. **Share as Message**: Share post in existing conversation (if messaging exists)

**Behavior:**
- Share creates a "Share" object, NOT a duplicate post
- Original post metadata is preserved
- Share count is aggregated
- Share shows original post content + sharer's comment
- Permission check: Can't share private post publicly
- Visibility propagation: Share inherits visibility rules
- Event to notification-service: Notify original author
- Prevent invalid shares: Private → Public leak prevention

#### 3.2 Data Model

```prisma
model Share {
  id              String   @id @default(uuid())
  originalPostId  String   // The post being shared
  sharedById      String   // User who shared
  shareType       ShareType
  comment         String?  // Optional comment from sharer
  visibility      PostVisibility @default(PUBLIC)
  sharedToUserId  String?  // If ShareType is PRIVATE_MESSAGE
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  deletedAt       DateTime?
  
  // Relations
  originalPost    Post     @relation("OriginalPost", fields: [originalPostId], references: [id])
  sharedBy        User     @relation("UserShares", fields: [sharedById], references: [id])
  sharedTo        User?    @relation("SharedToUser", fields: [sharedToUserId], references: [id])
  
  @@index([originalPostId])
  @@index([sharedById])
  @@index([shareType])
  @@index([createdAt])
}

enum ShareType {
  TO_FEED        // Shared to sharer's feed
  PRIVATE_MESSAGE // Shared privately to another user
  TO_CONVERSATION // Shared in existing conversation
}

// Add to Post model
model Post {
  // ... existing fields
  shares          Share[]  @relation("OriginalPost")
  shareCount      Int      @default(0) // Denormalized
}
```

#### 3.3 API Design

**gRPC:**
```protobuf
rpc SharePost(SharePostRequest) returns (SharePostResponse);
rpc GetPostShares(GetPostSharesRequest) returns (GetPostSharesResponse);
rpc UnsharePost(UnsharePostRequest) returns (UnsharePostResponse);

message SharePostRequest {
  string original_post_id = 1;
  string user_id = 2;
  ShareType share_type = 3;
  optional string comment = 4;
  PostVisibility visibility = 5;
  optional string shared_to_user_id = 6; // For PRIVATE_MESSAGE
  string idempotency_key = 7;
}

message SharePostResponse {
  bool success = 1;
  string share_id = 2;
  Share share = 3;
}
```

**REST:**
```
POST /api/v1/posts/:postId/share
Body: {
  shareType: "TO_FEED" | "PRIVATE_MESSAGE" | "TO_CONVERSATION",
  comment?: string,
  visibility: "PUBLIC" | "PRIVATE" | "CONNECTIONS_ONLY",
  sharedToUserId?: string
}
```

#### 3.4 Implementation Architecture

**Service Logic:**
```typescript
class ShareService {
  async sharePost(data: SharePostRequest): Promise<SharePostResponse> {
    // 1. Validate idempotency
    await this.checkIdempotency(data.idempotencyKey);
    
    // 2. Get original post
    const originalPost = await this.postRepository.getById(data.originalPostId);
    if (!originalPost) throw new Error('Post not found');
    
    // 3. Permission check
    await this.validateSharePermission(originalPost, data);
    
    // 4. Visibility check - prevent private → public leak
    const effectiveVisibility = this.calculateEffectiveVisibility(
      originalPost.visibility,
      data.visibility
    );
    
    // 5. Create share record (transaction)
    const share = await prisma.$transaction(async (tx) => {
      const share = await tx.share.create({
        data: {
          originalPostId: data.originalPostId,
          sharedById: data.userId,
          shareType: data.shareType,
          comment: data.comment,
          visibility: effectiveVisibility,
          sharedToUserId: data.sharedToUserId
        }
      });
      
      // Update share count (denormalized)
      await tx.posts.update({
        where: { id: data.originalPostId },
        data: { shareCount: { increment: 1 } }
      });
      
      return share;
    });
    
    // 6. Invalidate cache
    await this.cacheService.invalidatePostCache(data.originalPostId);
    await this.cacheService.invalidateUserFeedCache(data.userId);
    
    // 7. Publish event
    await this.kafkaProducer.send({
      topic: 'post.shared',
      messages: [{
        key: data.originalPostId,
        value: JSON.stringify({
          shareId: share.id,
          originalPostId: data.originalPostId,
          originalAuthorId: originalPost.userId,
          sharedById: data.userId,
          shareType: data.shareType,
          timestamp: new Date().toISOString()
        })
      }]
    });
    
    return { success: true, shareId: share.id, share };
  }
  
  private async validateSharePermission(
    originalPost: Post,
    shareRequest: SharePostRequest
  ): Promise<void> {
    // Can't share private post publicly
    if (originalPost.visibility === 'PRIVATE' && 
        shareRequest.visibility === 'PUBLIC') {
      throw new Error('Cannot share private post publicly');
    }
    
    // Can't share if original author disabled sharing
    if (originalPost.sharingDisabled) {
      throw new Error('Sharing disabled for this post');
    }
  }
  
  private calculateEffectiveVisibility(
    originalVisibility: PostVisibility,
    requestedVisibility: PostVisibility
  ): PostVisibility {
    // Share visibility cannot be more permissive than original
    const visibilityHierarchy = {
      PRIVATE: 0,
      CONNECTIONS_ONLY: 1,
      PUBLIC: 2
    };
    
    const originalLevel = visibilityHierarchy[originalVisibility];
    const requestedLevel = visibilityHierarchy[requestedVisibility];
    
    return requestedLevel <= originalLevel 
      ? requestedVisibility 
      : originalVisibility;
  }
}
```

**Feed Query Update:**
When fetching feed, include shares:
```typescript
// In feed.repository.ts
async getFeed(userId: string, options: FeedOptions): Promise<FeedItem[]> {
  const posts = await prisma.posts.findMany({
    where: {
      OR: [
        { userId }, // User's own posts
        { shares: { some: { sharedById: userId } } } // Posts shared by user
      ],
      visibility: { in: this.getVisibleVisibilities(userId) }
    },
    include: {
      user: true,
      attachments: true,
      _count: {
        select: { likes: true, comments: true, shares: true }
      },
      shares: {
        where: { sharedById: userId },
        take: 1,
        orderBy: { createdAt: 'desc' }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: options.limit,
    skip: options.offset
  });
  
  return posts.map(post => this.mapToFeedItem(post));
}
```

**Notification Event:**
```typescript
// In notification-service consumer
async handlePostShared(event: PostSharedEvent) {
  // Don't notify if user shared their own post
  if (event.originalAuthorId === event.sharedById) return;
  
  await this.notificationRepository.create({
    userId: event.originalAuthorId,
    type: 'POST_SHARED',
    data: {
      postId: event.originalPostId,
      sharedById: event.sharedById,
      shareType: event.shareType
    }
  });
}
```

---

### Feature 4: Edit Post (Production-Ready)

#### 4.1 Requirements

**User Actions:**
- Edit own posts only
- Edit text content
- Edit attachments (add/remove/replace media)
- See edit history (optional)

**System Behavior:**
- Versioning: Keep old versions for audit/restore
- Lock editing when attachments are processing
- Update feed cache correctly
- gRPC notifications for edited posts
- Image/video reprocessing if replaced
- Update search index (if Elasticsearch/Algolia used)
- Prevent editing after X hours (optional: LinkedIn allows editing anytime)

#### 4.2 Data Model

```prisma
model PostVersion {
  id            String   @id @default(uuid())
  postId        String
  versionNumber Int
  content       String
  editedAt      DateTime @default(now())
  editedById    String
  
  // Store attachment IDs at this version
  attachmentIds String[] // Array of attachment IDs
  
  post          Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  
  @@unique([postId, versionNumber])
  @@index([postId])
}

// Add to Post model
model Post {
  // ... existing fields
  versions      PostVersion[]
  currentVersion Int      @default(1)
  isEditing     Boolean   @default(false) // Lock flag
  lastEditedAt  DateTime?
  editCount     Int       @default(0)
}
```

#### 4.3 API Design

**gRPC:**
```protobuf
rpc EditPost(EditPostRequest) returns (EditPostResponse);
rpc GetPostVersions(GetPostVersionsRequest) returns (GetPostVersionsResponse);
rpc RestorePostVersion(RestorePostVersionRequest) returns (RestorePostVersionResponse);

message EditPostRequest {
  string post_id = 1;
  string user_id = 2;
  optional string content = 3;
  repeated string add_attachment_ids = 4; // New attachments to add
  repeated string remove_attachment_ids = 5; // Attachments to remove
  string idempotency_key = 6;
}

message EditPostResponse {
  bool success = 1;
  Post post = 2;
  int32 new_version_number = 3;
}
```

**REST:**
```
PATCH /api/v1/posts/:postId
Body: {
  content?: string,
  addAttachmentIds?: string[],
  removeAttachmentIds?: string[]
}
```

#### 4.4 Implementation Architecture

**Service:**
```typescript
class PostService {
  async editPost(data: EditPostRequest): Promise<EditPostResponse> {
    // 1. Get post
    const post = await this.postRepository.getById(data.postId);
    if (!post) throw new Error('Post not found');
    
    // 2. Authorization: Only owner can edit
    if (post.userId !== data.userId) {
      throw new Error('Unauthorized: Only post owner can edit');
    }
    
    // 3. Check if post is locked (attachments processing)
    if (post.isEditing) {
      throw new Error('Post is currently being edited. Please wait.');
    }
    
    // 4. Lock post for editing
    await this.postRepository.lockForEditing(data.postId);
    
    try {
      // 5. Validate attachments
      if (data.addAttachmentIds?.length) {
        await this.validateAttachments(data.addAttachmentIds, data.userId);
      }
      
      // 6. Create new version (transaction)
      const result = await prisma.$transaction(async (tx) => {
        // Create version record
        const newVersionNumber = post.currentVersion + 1;
        const newContent = data.content ?? post.content;
        
        // Get current attachments
        const currentAttachments = await tx.attachments.findMany({
          where: { postId: data.postId }
        });
        
        // Calculate new attachment set
        const attachmentIdsToKeep = currentAttachments
          .map(a => a.id)
          .filter(id => !data.removeAttachmentIds?.includes(id));
        const newAttachmentIds = [
          ...attachmentIdsToKeep,
          ...(data.addAttachmentIds || [])
        ];
        
        // Create version
        await tx.postVersion.create({
          data: {
            postId: data.postId,
            versionNumber: newVersionNumber,
            content: newContent,
            attachmentIds: newAttachmentIds,
            editedById: data.userId
          }
        });
        
        // Update post
        const updatedPost = await tx.posts.update({
          where: { id: data.postId },
          data: {
            content: newContent,
            currentVersion: newVersionNumber,
            lastEditedAt: new Date(),
            editCount: { increment: 1 },
            isEditing: false // Unlock
          },
          include: {
            attachments: true,
            user: true
          }
        });
        
        // Update attachments
        if (data.removeAttachmentIds?.length) {
          await tx.attachments.deleteMany({
            where: {
              id: { in: data.removeAttachmentIds },
              postId: data.postId
            }
          });
        }
        
        if (data.addAttachmentIds?.length) {
          await tx.attachments.updateMany({
            where: { id: { in: data.addAttachmentIds } },
            data: { postId: data.postId }
          });
        }
        
        return { post: updatedPost, versionNumber: newVersionNumber };
      });
      
      // 7. Invalidate caches
      await this.cacheService.invalidatePostCache(data.postId);
      await this.cacheService.invalidateUserFeedCache(data.userId);
      
      // 8. Reprocess media if needed (background job)
      if (data.addAttachmentIds?.length) {
        await this.jobQueue.add('process-post-media', {
          postId: data.postId,
          attachmentIds: data.addAttachmentIds
        });
      }
      
      // 9. Update search index (async)
      await this.searchService.updatePostIndex(result.post);
      
      // 10. Publish event
      await this.kafkaProducer.send({
        topic: 'post.edited',
        messages: [{
          key: data.postId,
          value: JSON.stringify({
            postId: data.postId,
            userId: data.userId,
            versionNumber: result.versionNumber,
            timestamp: new Date().toISOString()
          })
        }]
      });
      
      return {
        success: true,
        post: result.post,
        newVersionNumber: result.versionNumber
      };
      
    } catch (error) {
      // Unlock on error
      await this.postRepository.unlockEditing(data.postId);
      throw error;
    }
  }
  
  async getPostVersions(postId: string, userId: string): Promise<PostVersion[]> {
    // Verify ownership
    const post = await this.postRepository.getById(postId);
    if (!post || post.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    return this.postVersionRepository.getByPostId(postId);
  }
  
  async restorePostVersion(
    postId: string,
    versionNumber: number,
    userId: string
  ): Promise<Post> {
    // Get version
    const version = await this.postVersionRepository.getByPostAndVersion(
      postId,
      versionNumber
    );
    if (!version) throw new Error('Version not found');
    
    // Verify ownership
    const post = await this.postRepository.getById(postId);
    if (!post || post.userId !== userId) {
      throw new Error('Unauthorized');
    }
    
    // Restore (create new version with old content)
    return this.editPost({
      postId,
      userId,
      content: version.content,
      addAttachmentIds: version.attachmentIds,
      removeAttachmentIds: [] // Remove all current, add back version's attachments
    });
  }
}
```

**Lock Mechanism:**
```typescript
// In post.repository.ts
async lockForEditing(postId: string): Promise<void> {
  const locked = await redis.set(
    `post:edit:lock:${postId}`,
    '1',
    'EX',
    300, // 5 minute lock
    'NX' // Only set if not exists
  );
  
  if (!locked) {
    throw new Error('Post is currently being edited');
  }
  
  await prisma.posts.update({
    where: { id: postId },
    data: { isEditing: true }
  });
}

async unlockEditing(postId: string): Promise<void> {
  await redis.del(`post:edit:lock:${postId}`);
  await prisma.posts.update({
    where: { id: postId },
    data: { isEditing: false }
  });
}
```

---

## 📐 PHASE 3: INDUSTRIAL STANDARDS & BEST PRACTICES

### 3.1 Clean Architecture Principles

**Layer Separation:**
```
Controller (HTTP/gRPC) 
  → Service (Business Logic)
    → Repository (Data Access)
      → Database/External APIs
```

**Rules:**
- ✅ Controllers: Only handle HTTP/gRPC, validation, auth
- ✅ Services: All business logic, orchestration
- ✅ Repositories: Only data access, no business logic
- ❌ Never put business logic in controllers
- ❌ Never put business logic in repositories

### 3.2 CQRS Pattern (Where Applicable)

**Use CQRS for:**
- Read-heavy operations (feeds, analytics)
- Write-heavy operations (reporting, sharing)

**Example:**
```typescript
// Command (Write)
class ReportPostCommand {
  async execute(data: ReportPostRequest): Promise<void> {
    // Write logic
  }
}

// Query (Read)
class GetPostReportsQuery {
  async execute(filters: ReportFilters): Promise<PostReport[]> {
    // Read logic with optimized query
  }
}
```

### 3.3 Event-Driven Architecture

**Event Topics:**
- `post.reported` - Post reported
- `post.shared` - Post shared
- `post.edited` - Post edited
- `post.link.generated` - Share link generated
- `post.visibility.changed` - Post visibility changed

**Event Schema:**
```typescript
interface BaseEvent {
  eventId: string;
  eventType: string;
  timestamp: string;
  userId?: string;
  metadata?: Record<string, any>;
}

interface PostReportedEvent extends BaseEvent {
  eventType: 'post.reported';
  postId: string;
  reportId: string;
  category: ReportCategory;
  severity: ReportSeverity;
}
```

### 3.4 Background Job Processing

**Use Background Jobs For:**
- Media processing (image/video)
- Cache invalidation
- Search index updates
- Notification sending
- Analytics aggregation

**Job Queue Pattern:**
```typescript
// Use BullMQ or similar
const jobQueue = new Queue('post-processing', {
  connection: redis
});

// Add job
await jobQueue.add('process-media', {
  postId,
  attachmentIds
}, {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 2000
  }
});
```

### 3.5 Idempotency

**Implementation:**
```typescript
async function withIdempotency<T>(
  key: string,
  ttl: number,
  operation: () => Promise<T>
): Promise<T> {
  // Check cache
  const cached = await redis.get(`idempotency:${key}`);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute operation
  const result = await operation();
  
  // Cache result
  await redis.setex(
    `idempotency:${key}`,
    ttl,
    JSON.stringify(result)
  );
  
  return result;
}
```

### 3.6 Retry with Exponential Backoff

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) break;
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
  
  throw lastError!;
}
```

### 3.7 Rate Limiting

```typescript
async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<boolean> {
  const count = await redis.incr(`rate:${key}`);
  
  if (count === 1) {
    await redis.expire(`rate:${key}`, windowSeconds);
  }
  
  return count <= maxRequests;
}
```

### 3.8 Cache Invalidation Strategy

**Cache Keys:**
- `post:{postId}` - Single post
- `user:{userId}:feed` - User feed
- `post:{postId}:comments` - Post comments
- `post:{postId}:shares` - Post shares

**Invalidation Rules:**
- Post edited → Invalidate `post:{postId}`, `user:{userId}:feed`
- Post shared → Invalidate `post:{postId}:shares`, `user:{userId}:feed`
- Post reported → Invalidate `post:{postId}` (if hidden)

### 3.9 Error Handling

```typescript
class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 500,
    public isOperational: boolean = true
  ) {
    super(message);
  }
}

// Usage
throw new AppError(
  'POST_NOT_FOUND',
  'Post not found',
  404
);
```

### 3.10 Logging & Monitoring

```typescript
import { Logger } from 'winston';

const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Structured logging
logger.info('Post reported', {
  postId,
  reportId,
  category,
  userId,
  timestamp: new Date().toISOString()
});
```

---

## 📦 PHASE 4: DELIVERABLES

### Deliverable 1: Architecture Audit Report

**Format:**
```markdown
# Post Features Architecture Audit

## Current State Analysis
- Data Flow Diagrams
- Event Flow Diagrams
- Service Communication Patterns
- Database Schema Review
- Cache Strategy Review

## What's Correct ✅
- [List of good practices found]

## What's Wrong ❌
- [List of issues with severity levels]

## What Needs Restructuring 🔧
- [List of refactoring needs]

## Missing Industrial Standards
- [List of gaps]
```

### Deliverable 2: Engineering Plan

**Include:**
1. **Data Models**: Complete Prisma schema changes
2. **API Specifications**: gRPC proto files + REST endpoint docs
3. **Service Architecture**: Service layer design
4. **Event Flows**: Kafka event schemas
5. **Database Migrations**: Migration scripts
6. **Cache Strategy**: Redis key patterns
7. **Error Handling**: Error codes and messages
8. **Retry Rules**: Retry policies
9. **Rate Limiting**: Rate limit rules
10. **Background Jobs**: Job definitions

### Deliverable 3: PR-Ready Code

**Structure:**
```
post-service/
├── src/
│   ├── controllers/
│   │   └── impliments/
│   │       ├── report.controller.ts      # NEW
│   │       ├── share.controller.ts       # NEW/UPDATED
│   │       └── post.controller.ts        # UPDATED (edit)
│   ├── services/
│   │   ├── impliments/
│   │   │   ├── report.service.ts         # NEW
│   │   │   ├── share.service.ts          # NEW/UPDATED
│   │   │   └── post.service.ts           # UPDATED (edit)
│   │   └── interfaces/
│   │       ├── IReportService.ts         # NEW
│   │       └── IShareService.ts          # NEW
│   ├── repositories/
│   │   ├── impliments/
│   │   │   ├── report.repository.ts      # NEW
│   │   │   ├── share.repository.ts       # NEW/UPDATED
│   │   │   └── post.repository.ts        # UPDATED
│   │   └── interface/
│   │       ├── IReportRepository.ts      # NEW
│   │       └── IShareRepository.ts       # NEW/UPDATED
│   └── routes/
│       └── engagement.routes.ts          # UPDATED

client/
├── src/
│   ├── components/
│   │   └── feed/
│   │       └── feedEditor/
│   │           ├── ReportPostModal.tsx   # NEW
│   │           ├── SharePostModal.tsx    # NEW
│   │           ├── EditPostModal.tsx     # NEW
│   │           └── PostActions.tsx       # UPDATED
│   ├── hooks/
│   │   ├── useReportPost.ts              # NEW
│   │   ├── useSharePost.ts               # NEW
│   │   ├── useCopyPostLink.ts            # NEW
│   │   └── useEditPost.ts                # NEW
│   └── lib/
│       └── api/
│           ├── report.api.ts             # NEW
│           ├── share.api.ts              # NEW
│           └── post.api.ts              # UPDATED
```

### Deliverable 4: Testing Plan

**Unit Tests:**
- Service layer tests
- Repository layer tests
- Utility function tests

**Integration Tests:**
- API endpoint tests
- gRPC service tests
- Database transaction tests

**E2E Tests:**
- Full user flows
- Error scenarios
- Edge cases

### Deliverable 5: Architecture Documentation

**README.md Structure:**
```markdown
# Post Features Architecture

## Overview
## Architecture Diagrams
## Data Models
## API Reference
## Event Flows
## Cache Strategy
## Error Handling
## Deployment Guide
## Monitoring & Observability
```

---

## ✅ IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Complete file inspection
- [ ] Architecture audit completed
- [ ] Engineering plan approved
- [ ] Database migrations designed
- [ ] API contracts defined

### Implementation
- [ ] Post reporting system
- [ ] Copy post link
- [ ] Internal sharing
- [ ] Edit post
- [ ] Background jobs
- [ ] Cache invalidation
- [ ] Event publishing
- [ ] Error handling
- [ ] Rate limiting
- [ ] Idempotency

### Testing
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] E2E tests written
- [ ] Load testing completed
- [ ] Security testing completed

### Documentation
- [ ] API documentation
- [ ] Architecture documentation
- [ ] Deployment guide
- [ ] Monitoring guide

---

## 🚀 START HERE

**Step 1**: Confirm this prompt is complete and accurate  
**Step 2**: Begin file inspection using the checklist above  
**Step 3**: Generate architecture audit report  
**Step 4**: Create engineering plan  
**Step 5**: Implement features following the plan  
**Step 6**: Write tests  
**Step 7**: Document everything  

**Ready to begin? Confirm and I'll start the comprehensive analysis.**
