# Project Showcasing Feature - Complete Implementation Prompt

**Date**: 2024  
**Target**: Production-ready Project Showcasing feature matching LinkedIn/GitHub Showcase standards  
**Architecture**: Next.js 15 (App Router) + Microservices (TypeScript) + PostgreSQL + Prisma + Redis + Kafka + S3

---

## Executive Summary

This prompt provides a complete, production-ready implementation guide for a Project Showcasing feature where users can:
- Publish projects (GitHub/website links, media, description, tech stack)
- Like, comment, share, and report projects
- View trending/top projects on a showcase home page
- Search and filter projects by tech stack, tags, period

**Architecture Pattern**: Follows existing microservices architecture with:
- New `project-service` microservice (gRPC + HTTP REST)
- Repository → Service → Controller → gRPC pattern
- Outbox pattern for reliable event publishing (Kafka)
- Redis caching for trending/views
- S3 presigned URLs for media uploads
- Background workers for media processing

---

## Part 1: Database Schema (Prisma)

### Location: `project-service/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProjectVisibility {
  PUBLIC
  PRIVATE
  VISIBILITY_CONNECTIONS
}

enum ProjectStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
  REMOVED // Soft delete
}

enum MediaProcessingStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

enum ReportStatus {
  OPEN
  INVESTIGATING
  CLOSED
  RESOLVED
}

enum ReportReason {
  SPAM
  INAPPROPRIATE
  HARASSMENT
  COPYRIGHT
  MISLEADING
  OTHER
}

enum OutboxAggregateType {
  PROJECT
  PROJECT_LIKE
  PROJECT_COMMENT
  PROJECT_SHARE
  PROJECT_REPORT
}

enum OutboxEventType {
  PROJECT_CREATED
  PROJECT_UPDATED
  PROJECT_PUBLISHED
  PROJECT_LIKE_CREATED
  PROJECT_LIKE_REMOVED
  PROJECT_COMMENT_CREATED
  PROJECT_COMMENT_EDITED
  PROJECT_COMMENT_DELETED
  PROJECT_SHARE_CREATED
  PROJECT_REPORT_CREATED
}

// Main Project model
model Project {
  id          String   @id @default(cuid())
  title       String
  description String   // Markdown-supported
  userId      String   // Author ID
  
  // Repository links
  repositoryUrls String[] @default([]) // GitHub, GitLab, etc.
  demoUrl        String?  // Live demo URL
  
  // Tech stack and tags
  techStack String[] @default([]) // ["React", "TypeScript", "Node.js"]
  tags      String[] @default([]) // User-defined tags
  
  // Visibility and status
  visibility ProjectVisibility @default(PUBLIC)
  status     ProjectStatus     @default(DRAFT)
  
  // Denormalized counters (read-heavy pattern)
  likesCount    Int @default(0)
  commentsCount Int @default(0)
  sharesCount   Int @default(0)
  viewsCount    Int @default(0)
  reportsCount  Int @default(0)
  
  // Trending score (calculated periodically)
  trendingScore Float @default(0)
  
  // Soft delete and moderation
  deletedAt   DateTime?
  removedAt   DateTime? // Moderation removal
  removedBy   String?   // Moderator ID
  
  // Versioning
  version Int @default(1)
  
  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  publishedAt DateTime?
  
  // Relations
  media          ProjectMedia[]
  likes          ProjectLike[]
  comments       ProjectComment[]
  shares         ProjectShare[]
  reports        ProjectReport[]
  versions       ProjectVersion[] // Version history
  analytics      ProjectAnalytics[]
  
  @@index([userId])
  @@index([status])
  @@index([visibility])
  @@index([createdAt])
  @@index([publishedAt])
  @@index([trendingScore])
  @@index([techStack])
  @@index([tags])
  @@index([deletedAt])
  @@map("projects")
}

// Project media attachments
model ProjectMedia {
  id          String   @id @default(cuid())
  projectId   String
  type        String   // "IMAGE" | "VIDEO" | "SCREENSHOT"
  url         String   // S3 URL
  thumbnailUrl String? // Processed thumbnail
  order       Int      @default(0) // Display order
  isPreview   Boolean  @default(false) // Main preview image
  
  // Processing status
  processingStatus MediaProcessingStatus @default(PENDING)
  processingError  String?
  
  // Metadata
  width       Int?
  height      Int?
  fileSize    Int? // Bytes
  mimeType    String?
  duration    Int? // For videos (seconds)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  
  Project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
  @@index([processingStatus])
  @@map("project_media")
}

// Project likes (reactions)
model ProjectLike {
  id        String   @id @default(uuid())
  projectId String
  userId    String
  createdAt DateTime @default(now())
  deletedAt DateTime? // Soft delete for unlike
  
  Project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
  @@index([deletedAt])
  @@map("project_likes")
}

// Project comments (reuse existing comment patterns from post-service)
model ProjectComment {
  id              String   @id @default(uuid())
  projectId       String
  userId          String
  content         String
  parentCommentId String? // For replies (flat structure like posts)
  
  likesCount Int      @default(0)
  deletedAt  DateTime?
  editedAt   DateTime?
  version    Int      @default(1)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt
  
  Project        Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  ParentComment  ProjectComment? @relation("CommentReplies", fields: [parentCommentId], references: [id])
  Replies        ProjectComment[] @relation("CommentReplies")
  Reactions      ProjectCommentReaction[]
  Reports        ProjectReport[]
  
  @@index([projectId])
  @@index([userId])
  @@index([parentCommentId])
  @@index([deletedAt])
  @@map("project_comments")
}

// Comment reactions
model ProjectCommentReaction {
  id        String   @id @default(uuid())
  commentId String
  userId    String
  type      String   @default("LIKE") // LIKE, LOVE, etc.
  createdAt DateTime @default(now())
  deletedAt DateTime?
  
  ProjectComment ProjectComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  
  @@unique([commentId, userId, type])
  @@index([commentId])
  @@index([userId])
  @@map("project_comment_reactions")
}

// Project shares
model ProjectShare {
  id        String   @id @default(uuid())
  projectId String
  userId    String
  shareType String   @default("SHARE") // SHARE, QUOTE
  caption   String?
  createdAt DateTime @default(now())
  
  Project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
  @@index([userId])
  @@index([createdAt])
  @@map("project_shares")
}

// Project reports (moderation)
model ProjectReport {
  id         String       @id @default(uuid())
  reporterId String
  projectId  String?
  commentId  String? // If reporting a comment
  reason     ReportReason
  status     ReportStatus @default(OPEN)
  metadata   Json? // Additional context
  resolvedAt DateTime?
  resolvedBy String? // Moderator ID
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @default(now()) @updatedAt
  
  Project  Project?        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  Comment  ProjectComment? @relation(fields: [commentId], references: [id], onDelete: Cascade)
  
  @@unique([reporterId, projectId, commentId]) // One report per user per target
  @@index([projectId])
  @@index([commentId])
  @@index([status])
  @@index([createdAt])
  @@map("project_reports")
}

// Project version history (simple versioning)
model ProjectVersion {
  id        String   @id @default(uuid())
  projectId String
  version   Int
  title     String
  description String
  data      Json // Full project data snapshot
  createdAt DateTime @default(now())
  
  Project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@unique([projectId, version])
  @@index([projectId])
  @@map("project_versions")
}

// Project analytics (views, engagement tracking)
model ProjectAnalytics {
  id        String   @id @default(uuid())
  projectId String
  userId    String?  // NULL for anonymous views
  eventType String   // "VIEW", "LIKE", "SHARE", "COMMENT"
  metadata  Json?
  createdAt DateTime @default(now())
  
  Project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  @@index([projectId])
  @@index([userId])
  @@index([eventType])
  @@index([createdAt])
  @@map("project_analytics")
}

// Outbox pattern for reliable event publishing
model OutboxEvent {
  id              String              @id @default(uuid())
  aggregateType   OutboxAggregateType
  aggregateId     String?
  type            OutboxEventType
  topic           String
  key             String?
  payload         Json
  status          String              @default("PENDING") // PENDING, SENDING, SENT, FAILED
  attempts        Int                 @default(0)
  lastAttemptedAt DateTime?
  createdAt       DateTime            @default(now())
  publishedAt     DateTime?
  
  @@index([status])
  @@index([createdAt])
  @@index([aggregateType, aggregateId])
  @@map("outbox_events")
}

// Idempotency keys
model IdempotencyKey {
  id          String   @id @default(uuid())
  key         String   @unique
  userId      String
  method      String
  route       String
  requestHash String?
  response    Json?
  status      String   @default("IN_PROGRESS") // IN_PROGRESS, COMPLETED, FAILED
  createdAt   DateTime @default(now())
  updatedAt   DateTime @default(now()) @updatedAt
  
  @@index([userId])
  @@index([key])
  @@map("idempotency_keys")
}
```

---

## Part 2: Backend Microservice Structure

### 2.1 Service Directory Structure

```
project-service/
├── prisma/
│   └── schema.prisma
├── protos/
│   └── project.proto
├── src/
│   ├── config/
│   │   ├── prisma.config.ts
│   │   ├── redis.config.ts
│   │   ├── kafka.config.ts
│   │   └── grpc.client.ts
│   ├── repositories/
│   │   ├── interface/
│   │   │   ├── IProjectRepository.ts
│   │   │   ├── IProjectMediaRepository.ts
│   │   │   ├── IProjectLikeRepository.ts
│   │   │   ├── IProjectCommentRepository.ts
│   │   │   ├── IProjectShareRepository.ts
│   │   │   ├── IProjectReportRepository.ts
│   │   │   ├── IOutboxRepository.ts
│   │   │   └── IIdempotencyRepository.ts
│   │   └── impliments/
│   │       ├── base.repository.ts
│   │       ├── project.repository.ts
│   │       ├── project.media.repository.ts
│   │       ├── project.like.repository.ts
│   │       ├── project.comment.repository.ts
│   │       ├── project.share.repository.ts
│   │       ├── project.report.repository.ts
│   │       ├── outbox.repository.ts
│   │       └── idempotency.repository.ts
│   ├── services/
│   │   ├── interfaces/
│   │   │   ├── IProjectService.ts
│   │   │   ├── IProjectMediaService.ts
│   │   │   ├── IProjectLikeService.ts
│   │   │   ├── IProjectCommentService.ts
│   │   │   ├── IProjectShareService.ts
│   │   │   └── IProjectReportService.ts
│   │   └── impliments/
│   │       ├── project.service.ts
│   │       ├── project.media.service.ts
│   │       ├── project.like.service.ts
│   │       ├── project.comment.service.ts
│   │       ├── project.share.service.ts
│   │       ├── project.report.service.ts
│   │       ├── outbox.service.ts
│   │       └── outbox.processor.ts
│   ├── controllers/
│   │   └── impliments/
│   │       ├── project.controller.ts
│   │       ├── project.like.controller.ts
│   │       ├── project.comment.controller.ts
│   │       ├── project.share.controller.ts
│   │       └── project.report.controller.ts
│   ├── middlewares/
│   │   ├── idempotency.middleware.ts
│   │   ├── auth.middleware.ts
│   │   └── validation.middleware.ts
│   ├── utils/
│   │   ├── redis.util.ts
│   │   ├── kafka.util.ts
│   │   ├── error.util.ts
│   │   ├── logger.util.ts
│   │   └── trending.util.ts
│   ├── routes/
│   │   └── project.routes.ts
│   ├── grpc-server.ts
│   ├── index.ts
│   └── generate.ts
├── package.json
├── Dockerfile
└── .env.example
```

### 2.2 gRPC Proto Definition

**Location**: `project-service/protos/project.proto`

```protobuf
syntax = "proto3";

package project;

service ProjectService {
  // Project CRUD
  rpc CreateProject (CreateProjectRequest) returns (CreateProjectResponse);
  rpc UpdateProject (UpdateProjectRequest) returns (UpdateProjectResponse);
  rpc GetProject (GetProjectRequest) returns (GetProjectResponse);
  rpc ListProjects (ListProjectsRequest) returns (ListProjectsResponse);
  rpc DeleteProject (DeleteProjectRequest) returns (DeleteProjectResponse);
  rpc PublishProject (PublishProjectRequest) returns (PublishProjectResponse);
  
  // Trending and discovery
  rpc GetTrendingProjects (GetTrendingProjectsRequest) returns (GetTrendingProjectsResponse);
  rpc GetTopProjects (GetTopProjectsRequest) returns (GetTopProjectsResponse);
  rpc SearchProjects (SearchProjectsRequest) returns (SearchProjectsResponse);
  
  // Media
  rpc UploadProjectMedia (UploadProjectMediaRequest) returns (UploadProjectMediaRequest);
  
  // Engagement
  rpc LikeProject (LikeProjectRequest) returns (LikeProjectResponse);
  rpc UnlikeProject (UnlikeProjectRequest) returns (UnlikeProjectResponse);
  rpc ShareProject (ShareProjectRequest) returns (ShareProjectResponse);
  rpc ReportProject (ReportProjectRequest) returns (ReportProjectResponse);
  
  // Analytics
  rpc TrackProjectView (TrackProjectViewRequest) returns (TrackProjectViewResponse);
}

// Messages
message CreateProjectRequest {
  string userId = 1;
  string title = 2;
  string description = 3;
  repeated string repositoryUrls = 4;
  optional string demoUrl = 5;
  repeated string techStack = 6;
  repeated string tags = 7;
  string visibility = 8; // PUBLIC, PRIVATE, VISIBILITY_CONNECTIONS
  repeated string mediaIds = 9; // Pre-uploaded media IDs
}

message CreateProjectResponse {
  string id = 1;
  string title = 2;
  string status = 3; // DRAFT, PUBLISHED
  string createdAt = 4;
}

message UpdateProjectRequest {
  string projectId = 1;
  string userId = 2;
  optional string title = 3;
  optional string description = 4;
  repeated string repositoryUrls = 5;
  optional string demoUrl = 6;
  repeated string techStack = 7;
  repeated string tags = 8;
  optional string visibility = 9;
  repeated string mediaIds = 10;
}

message UpdateProjectResponse {
  string id = 1;
  string updatedAt = 2;
}

message GetProjectRequest {
  string projectId = 1;
  optional string userId = 2; // For checking like status
}

message GetProjectResponse {
  Project project = 1;
}

message ListProjectsRequest {
  optional string pageParam = 1;
  optional string userId = 2;
  optional string filter = 3; // "trending", "newest", "top"
  repeated string techStack = 4;
  repeated string tags = 5;
  optional string period = 6; // "day", "week", "month", "all"
  int32 limit = 7;
}

message ListProjectsResponse {
  repeated Project projects = 1;
  optional string nextCursor = 2;
  int32 totalCount = 3;
}

message GetTrendingProjectsRequest {
  optional string pageParam = 1;
  optional string userId = 2;
  int32 limit = 3;
  optional string period = 4; // "day", "week", "month"
}

message GetTrendingProjectsResponse {
  repeated Project projects = 1;
  optional string nextCursor = 2;
}

message GetTopProjectsRequest {
  optional string pageParam = 1;
  optional string userId = 2;
  int32 limit = 3;
  optional string period = 4;
}

message GetTopProjectsResponse {
  repeated Project projects = 1;
  optional string nextCursor = 2;
}

message SearchProjectsRequest {
  string query = 1;
  optional string pageParam = 2;
  optional string userId = 3;
  repeated string techStack = 4;
  repeated string tags = 5;
  int32 limit = 6;
}

message SearchProjectsResponse {
  repeated Project projects = 1;
  optional string nextCursor = 2;
  int32 totalCount = 3;
}

message DeleteProjectRequest {
  string projectId = 1;
  string userId = 2;
}

message DeleteProjectResponse {
  string id = 1;
  bool success = 2;
}

message PublishProjectRequest {
  string projectId = 1;
  string userId = 2;
}

message PublishProjectResponse {
  string id = 1;
  string status = 2;
  string publishedAt = 3;
}

message UploadProjectMediaRequest {
  string url = 1;
  string type = 2; // IMAGE, VIDEO, SCREENSHOT
  optional int32 width = 3;
  optional int32 height = 4;
  optional int32 fileSize = 5;
  optional string mimeType = 6;
}

message UploadProjectMediaResponse {
  string mediaId = 1;
  string url = 2;
}

message LikeProjectRequest {
  string projectId = 1;
  string userId = 2;
}

message LikeProjectResponse {
  bool isLiked = 1;
  int32 likesCount = 2;
}

message UnlikeProjectRequest {
  string projectId = 1;
  string userId = 2;
}

message UnlikeProjectResponse {
  bool isLiked = 1;
  int32 likesCount = 2;
}

message ShareProjectRequest {
  string projectId = 1;
  string userId = 2;
  optional string caption = 3;
  string shareType = 4; // SHARE, QUOTE
}

message ShareProjectResponse {
  string shareId = 1;
  int32 sharesCount = 2;
}

message ReportProjectRequest {
  string projectId = 1;
  string reporterId = 2;
  string reason = 3; // SPAM, INAPPROPRIATE, etc.
  optional string metadata = 4; // JSON string
}

message ReportProjectResponse {
  string reportId = 1;
  bool success = 2;
}

message TrackProjectViewRequest {
  string projectId = 1;
  optional string userId = 2; // NULL for anonymous
}

message TrackProjectViewResponse {
  bool success = 1;
  int32 viewsCount = 2;
}

// Project model
message Project {
  string id = 1;
  string title = 2;
  string description = 3;
  string userId = 4;
  repeated string repositoryUrls = 5;
  optional string demoUrl = 6;
  repeated string techStack = 7;
  repeated string tags = 8;
  string visibility = 9;
  string status = 10;
  ProjectEngagement engagement = 11;
  repeated ProjectMedia media = 12;
  UserProfile author = 13;
  string createdAt = 14;
  string updatedAt = 15;
  optional string publishedAt = 16;
  float trendingScore = 17;
}

message ProjectEngagement {
  int32 likesCount = 1;
  int32 commentsCount = 2;
  int32 sharesCount = 3;
  int32 viewsCount = 4;
  bool isLiked = 5;
  bool isShared = 6;
}

message ProjectMedia {
  string id = 1;
  string type = 2;
  string url = 3;
  optional string thumbnailUrl = 4;
  int32 order = 5;
  bool isPreview = 6;
  optional int32 width = 7;
  optional int32 height = 8;
  optional int32 duration = 9;
}

message UserProfile {
  string id = 1;
  string name = 2;
  string username = 3;
  string avatar = 4;
}
```

---

## Part 3: Repository Implementation Patterns

### 3.1 Project Repository

**Location**: `project-service/src/repositories/impliments/project.repository.ts`

**Key Methods**:
- `createProject(data)`: Create project with transaction
- `updateProject(projectId, data)`: Update with versioning
- `getProjectById(projectId, userId?)`: Get with engagement status
- `listProjects(options)`: Paginated listing with filters
- `getTrendingProjects(options)`: Trending algorithm
- `getTopProjects(options)`: Top by engagement
- `searchProjects(query, filters)`: Full-text search
- `deleteProject(projectId, userId)`: Soft delete
- `publishProject(projectId, userId)`: Change status to PUBLISHED
- `incrementViews(projectId)`: Atomic view counter
- `updateTrendingScore(projectId, score)`: Update trending calculation

**Pattern**: Follow `post-service/src/repositories/impliments/post.repository.ts` structure

### 3.2 Project Like Repository

**Location**: `project-service/src/repositories/impliments/project.like.repository.ts`

**Key Methods**:
- `likeProject(projectId, userId)`: Create like, increment counter
- `unlikeProject(projectId, userId)`: Soft delete, decrement counter
- `getUserLikesForProjects(userId, projectIds)`: Batch check liked status
- `getLikesCount(projectId)`: Get count (cached in Redis)

**Pattern**: Follow `post-service/src/repositories/impliments/like.repository.ts` structure

### 3.3 Project Comment Repository

**Location**: `project-service/src/repositories/impliments/project.comment.repository.ts`

**Key Methods**:
- `createComment(data)`: Create comment (flat structure like posts)
- `getCommentsByProject(projectId, options)`: Paginated comments with replies
- `updateComment(commentId, content)`: Edit with versioning
- `deleteComment(commentId)`: Soft delete
- `getCommentPreview(projectId)`: First comment for preview

**Pattern**: Follow `post-service/src/repositories/impliments/comment.repository.ts` structure (two-level flat)

---

## Part 4: Service Layer Implementation

### 4.1 Project Service

**Location**: `project-service/src/services/impliments/project.service.ts`

**Key Methods**:
- `createProject(req)`: Validate, create, publish event
- `updateProject(req)`: Validate ownership, update, create version
- `getProject(req)`: Get with engagement, track view
- `listProjects(req)`: Apply filters, pagination
- `getTrendingProjects(req)`: Calculate trending score
- `getTopProjects(req)`: Sort by engagement metrics
- `searchProjects(req)`: Full-text search (future: Elasticsearch)
- `deleteProject(req)`: Soft delete, publish event
- `publishProject(req)`: Change status, notify followers

**Validation Rules**:
- Title: 3-200 characters
- Description: Max 10,000 characters (markdown)
- Repository URLs: Valid GitHub/GitLab URLs
- Demo URL: Valid HTTP/HTTPS URL
- Tech stack: Max 20 items
- Tags: Max 10 items, alphanumeric + hyphens
- Media: Max 10 files per project

**Event Publishing**:
- `PROJECT_CREATED` → Kafka topic: `project.created`
- `PROJECT_PUBLISHED` → Kafka topic: `project.published`
- `PROJECT_UPDATED` → Kafka topic: `project.updated`
- `PROJECT_DELETED` → Kafka topic: `project.deleted`

### 4.2 Trending Algorithm

**Location**: `project-service/src/utils/trending.util.ts`

**Formula** (short-term, can be enhanced):
```typescript
trendingScore = (
  (likesCount * 2) +
  (commentsCount * 3) +
  (sharesCount * 4) +
  (viewsCount * 0.1) +
  (recentActivityBonus) // Higher weight for recent activity
) / timeDecayFactor

// Time decay: projects older than 7 days get reduced score
timeDecayFactor = 1 + (daysSincePublished * 0.1)
```

**Implementation**:
- Calculate on project publish/update
- Recalculate periodically (cron job every hour)
- Cache in Redis with TTL
- Update database `trendingScore` field

---

## Part 5: API Gateway Integration

### 5.1 Routes

**Location**: `api-gateway/src/routes/projectService/project.routes.ts`

```typescript
// Project CRUD
POST   /api/v1/projects                    // Create project
GET    /api/v1/projects/:projectId         // Get project
PUT    /api/v1/projects/:projectId        // Update project
DELETE /api/v1/projects/:projectId        // Delete project
POST   /api/v1/projects/:projectId/publish // Publish project

// Discovery
GET    /api/v1/projects                    // List projects (with filters)
GET    /api/v1/projects/trending          // Trending projects
GET    /api/v1/projects/top               // Top projects
GET    /api/v1/projects/search            // Search projects

// Engagement
POST   /api/v1/projects/:projectId/like   // Like project
DELETE /api/v1/projects/:projectId/like   // Unlike project
POST   /api/v1/projects/:projectId/share  // Share project
POST   /api/v1/projects/:projectId/report // Report project

// Media
POST   /api/v1/projects/media             // Upload media (presigned URL)

// Analytics
POST   /api/v1/projects/:projectId/view   // Track view
```

### 5.2 gRPC Client Configuration

**Location**: `api-gateway/src/config/grpc.client.ts`

Add project service client:
```typescript
export const projectClient = new ProjectServiceClient(
  process.env.PROJECT_SERVICE_GRPC_URL || 'localhost:50053',
  credentials.createInsecure()
);
```

### 5.3 Controller

**Location**: `api-gateway/src/controllers/project/main.project.ts`

Follow pattern from `api-gateway/src/controllers/feed/main.feed.ts`:
- Extract JWT user from headers
- Call gRPC service
- Handle errors
- Return standardized response

---

## Part 6: Frontend Implementation (Next.js 15)

### 6.1 Page Structure

```
client/src/app/(main)/
├── projects/
│   ├── page.tsx                    // Showcase home (trending/top)
│   ├── [projectId]/
│   │   └── page.tsx                // Project detail page
│   └── create/
│       └── page.tsx                // Create project page
```

### 6.2 Components

```
client/src/components/projects/
├── ProjectCard.tsx                 // Project card for listings
├── ProjectDetail.tsx               // Full project detail view
├── CreateProjectModal.tsx          // Create/edit project form
├── ProjectMediaGallery.tsx         // Media gallery with preview
├── ProjectEngagement.tsx           // Like, share, comment buttons
├── ProjectCommentSection.tsx       // Comments (reuse CommentSection pattern)
├── ProjectFilters.tsx              // Filter by tech/tags/period
├── TrendingProjectsList.tsx        // Trending projects feed
└── TechStackBadge.tsx              // Tech stack display
```

### 6.3 API Service

**Location**: `client/src/services/api/project.service.ts`

```typescript
// CRUD
export const createProject = async (data, headers) => { ... }
export const updateProject = async (projectId, data, headers) => { ... }
export const getProject = async (projectId, headers) => { ... }
export const deleteProject = async (projectId, headers) => { ... }
export const publishProject = async (projectId, headers) => { ... }

// Discovery
export const getTrendingProjects = async (params, headers) => { ... }
export const getTopProjects = async (params, headers) => { ... }
export const searchProjects = async (query, filters, headers) => { ... }

// Engagement
export const likeProject = async (projectId, headers) => { ... }
export const unlikeProject = async (projectId, headers) => { ... }
export const shareProject = async (projectId, data, headers) => { ... }
export const reportProject = async (projectId, reason, headers) => { ... }

// Media
export const uploadProjectMedia = async (file, headers) => { ... }

// Analytics
export const trackProjectView = async (projectId, headers) => { ... }
```

### 6.4 React Query Hooks

**Location**: `client/src/components/projects/hooks/`

```typescript
// useCreateProjectMutation.ts
// useUpdateProjectMutation.ts
// useLikeProjectMutation.ts
// useShareProjectMutation.ts
// useProjectQuery.ts
// useTrendingProjectsQuery.ts
// useSearchProjectsQuery.ts
```

**Pattern**: Follow `client/src/components/feed/mutations/useSubmitPostMutation.ts`

### 6.5 Server Actions

**Location**: `client/src/components/projects/actions/`

```typescript
// submitProject.ts - Server action for project creation
// updateProject.ts - Server action for project update
```

**Pattern**: Follow `client/src/components/feed/feedEditor/actions/submitPost.ts`

---

## Part 7: Media Upload & Processing

### 7.1 Presigned URL Generation

**Location**: `api-gateway/src/utils/generate.presigned.url.ts`

Add project media presigned URL generation (reuse existing S3 pattern)

### 7.2 Media Processing Worker

**New Service**: `media-worker/` (or extend existing media service)

**Responsibilities**:
- Listen to Kafka topic: `project.media.uploaded`
- Generate thumbnails for images
- Transcode videos (multiple resolutions)
- Update `ProjectMedia.processingStatus`
- Publish `project.media.processed` event

**Kafka Consumer**:
```typescript
// Listen to: project.media.uploaded
// Process: thumbnail generation, video transcoding
// Update: ProjectMedia table
// Publish: project.media.processed
```

---

## Part 8: Event System (Kafka)

### 8.1 Topics

```
project.created          // Project created (DRAFT)
project.published        // Project published (PUBLISHED)
project.updated          // Project updated
project.deleted          // Project deleted
project.like.created     // Project liked
project.like.removed     // Project unliked
project.comment.created  // Comment added
project.share.created    // Project shared
project.report.created   // Project reported
project.media.uploaded   // Media uploaded (trigger processing)
project.media.processed  // Media processing complete
```

### 8.2 Notification Service Consumer

**Location**: `notification-service/src/consumers/project.consumer.ts`

**Events to Handle**:
- `project.published` → Notify followers
- `project.comment.created` → Notify project author
- `project.like.created` → Optional notification (if enabled)

---

## Part 9: Security & Validation

### 9.1 Validation Middleware

**Location**: `project-service/src/middlewares/validation.middleware.ts`

**Zod Schemas**:
```typescript
const createProjectSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(10000),
  repositoryUrls: z.array(z.string().url()).max(5),
  demoUrl: z.string().url().optional(),
  techStack: z.array(z.string()).max(20),
  tags: z.array(z.string().regex(/^[a-zA-Z0-9-]+$/)).max(10),
  visibility: z.enum(['PUBLIC', 'PRIVATE', 'VISIBILITY_CONNECTIONS']),
});
```

### 9.2 Authorization

- **Create/Update/Delete**: User must own project
- **View**: Respect visibility (PUBLIC, PRIVATE, VISIBILITY_CONNECTIONS)
- **Like/Share/Comment**: Respect visibility rules
- **Report**: Any authenticated user

### 9.3 Rate Limiting

- Project creation: 10 per hour per user
- Media upload: 20 per hour per user
- Like/Share: 100 per hour per user

---

## Part 10: Caching Strategy (Redis)

### 10.1 Cache Keys

```typescript
// Project cache
`project:${projectId}` // TTL: 1 hour
`project:${projectId}:engagement` // TTL: 5 minutes

// Trending cache
`projects:trending:${period}` // TTL: 1 hour
`projects:top:${period}` // TTL: 1 hour

// User likes cache
`user:${userId}:project-likes` // TTL: 10 minutes
```

### 10.2 Cache Invalidation

- On project update → Invalidate project cache
- On like/unlike → Invalidate engagement cache
- On trending recalculation → Invalidate trending cache

---

## Part 11: Docker & Infrastructure

### 11.1 Docker Compose Update

**Add to `docker-compose.yml`**:

```yaml
project-service:
  build:
    context: ./project-service
    dockerfile: Dockerfile
  container_name: project-service
  ports:
    - "3004:3004"
    - "50053:50053"
  depends_on:
    - kafka
    - zookeeper
    - redis
  env_file:
    - ./project-service/.env
  volumes:
    - ./project-service/src:/app/src
    - ./project-service/protos:/app/protos
    - ./project-service/src/grpc/generated:/app/src/grpc/generated
    - ./project-service/prisma:/app/prisma
    - /app/node_modules
  networks:
    - shared
  command: sh -c "npx ts-node src/generate.ts && npx prisma migrate deploy && npm run dev"
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3004/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 15s
  restart: unless-stopped
```

### 11.2 Environment Variables

**Location**: `project-service/.env.example`

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/project_db"

# Redis
REDIS_URL="redis://localhost:6379"

# Kafka
KAFKA_BROKER_URL="kafka:9092"

# gRPC
GRPC_PORT=50053
HTTP_PORT=3004

# S3 (for media)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=

# Auth Service gRPC
AUTH_SERVICE_GRPC_URL="auth-service:50051"

# Notification Service gRPC (if needed)
NOTIFICATION_SERVICE_GRPC_URL="notification-service:50052"
```

---

## Part 12: Testing Strategy

### 12.1 Unit Tests

- Repository methods
- Service business logic
- Validation schemas
- Trending algorithm

### 12.2 Integration Tests

- Project CRUD flow
- Like/Share/Comment flow
- Event publishing
- Media upload flow

### 12.3 E2E Tests

- Create project → Publish → View
- Like project → Check engagement
- Search and filter projects

---

## Part 13: Implementation Checklist

### Backend
- [ ] Create `project-service` directory structure
- [ ] Define Prisma schema
- [ ] Generate Prisma client
- [ ] Create gRPC proto file
- [ ] Generate gRPC code
- [ ] Implement repositories (base + specific)
- [ ] Implement services
- [ ] Implement controllers
- [ ] Set up routes
- [ ] Configure gRPC server
- [ ] Set up Kafka topics
- [ ] Implement outbox processor
- [ ] Add Redis caching
- [ ] Implement trending algorithm
- [ ] Add validation middleware
- [ ] Add idempotency middleware
- [ ] Write unit tests
- [ ] Write integration tests

### API Gateway
- [ ] Add project service routes
- [ ] Configure gRPC client
- [ ] Implement controllers
- [ ] Add authentication middleware
- [ ] Add rate limiting
- [ ] Add presigned URL generation

### Frontend
- [ ] Create project pages (list, detail, create)
- [ ] Create project components
- [ ] Implement API service
- [ ] Create React Query hooks
- [ ] Create server actions
- [ ] Implement media upload
- [ ] Add optimistic UI updates
- [ ] Add error handling
- [ ] Add loading states
- [ ] Write component tests

### Infrastructure
- [ ] Update docker-compose.yml
- [ ] Set up environment variables
- [ ] Configure database
- [ ] Set up Kafka topics
- [ ] Configure Redis
- [ ] Set up S3 bucket
- [ ] Deploy services

### Documentation
- [ ] API documentation
- [ ] Database schema docs
- [ ] Event schema docs
- [ ] Deployment guide

---

## Part 14: Production Considerations

### 14.1 Performance
- Database indexes (already in schema)
- Redis caching for trending/top
- Pagination for all lists
- Lazy loading for media
- CDN for media assets

### 14.2 Scalability
- Horizontal scaling (stateless services)
- Database read replicas (future)
- Elasticsearch for search (future)
- Message queue for heavy processing

### 14.3 Monitoring
- Logging (structured logs)
- Metrics (Prometheus)
- Error tracking (Sentry)
- Performance monitoring

### 14.4 Security
- Input validation
- SQL injection prevention (Prisma)
- XSS prevention (sanitize markdown)
- Rate limiting
- Authentication/authorization

---

## Conclusion

This prompt provides a complete, production-ready implementation guide for the Project Showcasing feature. Follow the existing patterns from `post-service` and `comment-service` to ensure consistency.

**Key Principles**:
1. Follow existing architecture patterns
2. Use outbox pattern for reliable events
3. Implement proper validation and authorization
4. Cache aggressively for read-heavy operations
5. Use transactions for data consistency
6. Implement idempotency for mutating operations
7. Follow Next.js 15 App Router patterns
8. Use React Query for data fetching
9. Implement optimistic UI updates
10. Add comprehensive error handling

**Next Steps**:
1. Review and confirm this prompt
2. Set up `project-service` directory
3. Implement database schema
4. Implement backend services
5. Integrate with API Gateway
6. Implement frontend
7. Test thoroughly
8. Deploy to production

---

**Status**: ✅ Ready for implementation
