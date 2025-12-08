# Production-Ready Post Creation System Review & Refactor Prompt

## Context
You have a Next.js 15 application with a microservices backend (TypeScript) implementing post creation with image and video uploads. The system needs to be hardened to production standards matching LinkedIn, Facebook, and Twitter implementations.

## Current Stack
- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Backend**: Microservices architecture (post-service, auth-service, notification-service)
- **Communication**: gRPC between services, HTTP REST API Gateway
- **Database**: PostgreSQL with Prisma ORM
- **Storage**: UploadThing (currently), S3 (available)
- **Caching**: Redis
- **Queue/Events**: Kafka (infrastructure exists)
- **Media Processing**: Not yet implemented (needs transcoding, thumbnails)

## Review Scope & Requirements

### 1. FULL ARCHITECTURE REVIEW

**Client-Side (Next.js 15)**
- [ ] Review all post creation components (`CreatePostModal`, `PhotoEditorModal`, `VideoEdit`)
- [ ] Review media upload hooks (`useMediaUpload`, `handleImageUpload`)
- [ ] Review server actions (`submitPost`)
- [ ] Review API routes (`/api/uploadthing/core.ts`)
- [ ] Validate Next.js 15 App Router usage (Server Actions, Server Components, Client Components)
- [ ] Check for proper use of React 19 features
- [ ] Review state management (Context API, React Query)
- [ ] Validate optimistic UI updates implementation
- [ ] Check for proper error boundaries and error handling

**API Gateway**
- [ ] Review route handlers (`/feed/submit`, `/feed/media`)
- [ ] Review authentication/authorization middleware
- [ ] Review rate limiting implementation
- [ ] Review request validation (DTOs, Zod schemas)
- [ ] Review error handling and response formatting
- [ ] Review gRPC client configuration and error handling

**Post Service (Microservice)**
- [ ] Review post creation service (`PostService.submitPost`)
- [ ] Review post repository (`PostRepository.submitPostRepo`)
- [ ] Review media service (`MediaService.uploadMediaService`)
- [ ] Review media repository (`MediaRepository.createMedia`)
- [ ] Review gRPC handlers and controllers
- [ ] Review database transaction usage
- [ ] Review event publishing (Outbox pattern)
- [ ] Review idempotency implementation

**Database Schema**
- [ ] Review Prisma schema (`posts`, `media`, `attachments` tables)
- [ ] Validate indexes and query optimization
- [ ] Check for proper relationships and foreign keys
- [ ] Review soft delete implementation
- [ ] Check for missing fields (processing status, metadata, etc.)

**Infrastructure**
- [ ] Review Docker configurations
- [ ] Review environment variable management
- [ ] Review Redis caching strategy
- [ ] Review Kafka topic configuration
- [ ] Review S3 bucket policies and IAM roles

### 2. SECURITY, RELIABILITY & CORRECTNESS

**Authentication & Authorization**
- [ ] Verify JWT token validation in all upload/post endpoints
- [ ] Verify user ownership checks before post operations
- [ ] Verify rate limiting per user (not just global)
- [ ] Check for proper session management

**File Validation & Security**
- [ ] Validate file type checking (MIME type, not just extension)
- [ ] Validate file size limits (client and server)
- [ ] Check for virus/malware scanning integration points
- [ ] Verify content-type validation
- [ ] Check for malicious file detection (e.g., fake image files)
- [ ] Validate file metadata sanitization

**Idempotency**
- [ ] Verify idempotency key implementation for post creation
- [ ] Check for duplicate prevention on retries
- [ ] Validate idempotency key storage and lookup
- [ ] Check expiration of idempotency keys

**Error Handling & Retries**
- [ ] Review error handling patterns across all services
- [ ] Check for proper error propagation (gRPC status codes)
- [ ] Verify retry logic with exponential backoff
- [ ] Check for circuit breakers
- [ ] Validate timeout configurations
- [ ] Review dead-letter queue implementation

**Data Consistency**
- [ ] Verify database transactions for atomic operations
- [ ] Check for proper rollback on failures
- [ ] Validate orphaned media cleanup
- [ ] Check for race condition handling

### 3. SCALABILITY & PERFORMANCE

**Upload Strategy**
- [ ] Review current upload flow (UploadThing vs direct S3)
- [ ] Recommend presigned URL approach for direct-to-S3
- [ ] Implement chunked/resumable uploads for large files
- [ ] Review multipart upload implementation
- [ ] Check for upload progress tracking
- [ ] Validate upload cancellation support

**Media Processing**
- [ ] Design video transcoding pipeline
- [ ] Design thumbnail generation workflow
- [ ] Review background job processing
- [ ] Check for processing status tracking
- [ ] Validate job retry logic
- [ ] Review job queue configuration

**CDN & Caching**
- [ ] Review CDN configuration for media serving
- [ ] Check cache invalidation on post creation
- [ ] Review Redis caching strategy
- [ ] Validate cache key naming conventions
- [ ] Check for cache warming strategies

**Database Performance**
- [ ] Review query optimization
- [ ] Check for N+1 query problems
- [ ] Validate pagination implementation
- [ ] Review connection pooling
- [ ] Check for read replicas usage

### 4. MICROSERVICES & INFRASTRUCTURE

**Service Communication**
- [ ] Review gRPC service definitions (protobuf files)
- [ ] Check for proper error handling in gRPC calls
- [ ] Validate service discovery
- [ ] Review load balancing configuration
- [ ] Check for service mesh considerations

**Message Queues & Events**
- [ ] Review Kafka topic structure
- [ ] Check for event schema versioning
- [ ] Validate outbox pattern implementation
- [ ] Review dead-letter queue handling
- [ ] Check for event ordering guarantees
- [ ] Review consumer group configuration

**Background Workers**
- [ ] Review worker implementation for media processing
- [ ] Check for worker scaling strategy
- [ ] Validate job scheduling
- [ ] Review job monitoring and alerting

**Observability**
- [ ] Review logging implementation
- [ ] Check for distributed tracing
- [ ] Validate metrics collection
- [ ] Review alerting configuration
- [ ] Check for error tracking (Sentry, etc.)

### 5. DATA MODEL & DATABASE

**Schema Review**
- [ ] Validate post table structure
- [ ] Check media/attachments table design
- [ ] Review processing status fields
- [ ] Check for metadata storage (dimensions, duration, etc.)
- [ ] Validate soft delete implementation
- [ ] Review audit fields (createdAt, updatedAt, deletedAt)

**Indexes & Optimization**
- [ ] Review all database indexes
- [ ] Check for missing indexes on foreign keys
- [ ] Validate composite indexes
- [ ] Review query execution plans
- [ ] Check for table partitioning needs

**Data Migration**
- [ ] Review migration strategy
- [ ] Check for backward compatibility
- [ ] Validate rollback procedures

### 6. UX / CLIENT BEHAVIOR

**Next.js 15 Best Practices**
- [ ] Verify proper use of Server Actions
- [ ] Check for Server Components where appropriate
- [ ] Validate Client Components usage
- [ ] Review streaming SSR implementation
- [ ] Check for Partial Prerendering (PPR) usage
- [ ] Validate edge function usage if applicable

**Upload UX**
- [ ] Review upload progress indicators
- [ ] Check for per-file progress tracking
- [ ] Validate upload cancellation
- [ ] Review retry UI for failed uploads
- [ ] Check for drag-and-drop support
- [ ] Validate mobile responsiveness

**Media Preview & Editing**
- [ ] Review image preview implementation
- [ ] Check for image cropping/editing
- [ ] Validate video preview
- [ ] Review media gallery implementation
- [ ] Check for thumbnail generation display

**Post Creation UX**
- [ ] Review post visibility controls
- [ ] Check for comment control settings
- [ ] Validate poll creation flow
- [ ] Review article creation (not yet implemented)
- [ ] Check for scheduled post support
- [ ] Validate draft post functionality

**Error Handling UX**
- [ ] Review error message display
- [ ] Check for retry mechanisms in UI
- [ ] Validate offline handling
- [ ] Review loading states

### 7. COST & OPERATIONS

**Storage Costs**
- [ ] Estimate S3 storage costs
- [ ] Review lifecycle policies
- [ ] Check for unused media cleanup
- [ ] Validate compression strategies

**Processing Costs**
- [ ] Estimate transcoding costs
- [ ] Review transcoding presets
- [ ] Check for cost optimization (e.g., only transcode on demand)
- [ ] Validate thumbnail generation costs

**CDN Costs**
- [ ] Estimate CDN bandwidth costs
- [ ] Review caching strategies
- [ ] Check for cost optimization

**Queue Costs**
- [ ] Estimate Kafka/RabbitMQ costs
- [ ] Review message retention policies
- [ ] Check for cost optimization

**Scaling Strategy**
- [ ] Review autoscaling configuration
- [ ] Check for cost limits
- [ ] Validate resource quotas

### 8. COMPLIANCE & MODERATION

**Content Moderation**
- [ ] Review automated content filtering
- [ ] Check for manual review queue
- [ ] Validate profanity filtering
- [ ] Review image content scanning
- [ ] Check for copyright detection

**Privacy & Data Retention**
- [ ] Review GDPR compliance
- [ ] Check for data retention policies
- [ ] Validate user data deletion
- [ ] Review privacy controls

**Logging & Audit**
- [ ] Review audit logging
- [ ] Check for compliance logging
- [ ] Validate log retention policies

### 9. TESTING & CI/CD

**Unit Tests**
- [ ] Review test coverage for post creation
- [ ] Check for upload handler tests
- [ ] Validate service layer tests
- [ ] Review repository tests

**Integration Tests**
- [ ] Review API integration tests
- [ ] Check for gRPC integration tests
- [ ] Validate database transaction tests
- [ ] Review upload flow tests

**E2E Tests**
- [ ] Review end-to-end post creation tests
- [ ] Check for upload flow tests
- [ ] Validate error scenario tests

**CI/CD**
- [ ] Review CI pipeline configuration
- [ ] Check for automated testing
- [ ] Validate deployment strategy
- [ ] Review feature flag implementation
- [ ] Check for canary deployment support

## Deliverables Required

### 1. Prioritized Checklist
Create a checklist with:
- **Critical (P0)**: Security vulnerabilities, data loss risks, breaking bugs
- **High (P1)**: Performance issues, missing transactions, poor error handling
- **Medium (P2)**: Missing features, UX improvements, optimization opportunities
- **Low (P3)**: Nice-to-have features, minor optimizations

### 2. Code Diffs / PR-Ready Patches
Provide exact code changes for:
- Client-side components (TypeScript/React)
- Server-side services (TypeScript)
- Database migrations (Prisma)
- Configuration files
- Tests (Jest/Vitest)

### 3. Example Implementations

**Presigned Upload Flow**
```typescript
// Client: Next.js component with resumable upload
// Server: API route generating presigned URLs
// Include: Progress tracking, chunked upload, retry logic
```

**Background Worker for Media Processing**
```typescript
// Worker: Kafka consumer processing media
// Include: Transcoding, thumbnail generation, status updates
// Include: Retry logic, error handling, dead-letter queue
```

**CDN Media Serving**
```typescript
// Signed URL generation for private content
// CDN configuration
// Cache invalidation strategy
```

**Idempotent Post Creation**
```typescript
// Idempotency key middleware
// Database idempotency key storage
// Client-side idempotency key generation
```

**Retry & Backoff Wrapper**
```typescript
// Generic retry wrapper for gRPC/HTTP
// Exponential backoff with jitter
// Circuit breaker pattern
```

**Integration Tests**
```typescript
// Test suite for upload flow
// Test suite for post creation
// Mocks for external services
```

### 4. Migration Notes
- Environment variable changes
- Database migration scripts
- S3 bucket configuration
- Queue topic setup
- IAM policy updates
- Feature flag configuration

### 5. README Documentation
- Local development setup
- Testing uploads locally
- Running worker jobs
- Environment configuration
- Troubleshooting guide

## Specific Implementation Requirements

### Uploads
- ✅ Must use presigned URLs for direct-to-storage (S3)
- ✅ Resumable/chunked upload for videos > 50MB
- ✅ Per-file progress tracking
- ✅ Upload cancellation support
- ✅ Client-side validation (MIME type, size)
- ✅ Server-side validation (MIME sniffing, not trusting extensions)
- ✅ Optional client-side image compression
- ✅ File metadata sanitization

### Post Creation
- ✅ Atomic post creation (transaction-wrapped)
- ✅ Idempotency key required
- ✅ Event-driven architecture (post created → emit event)
- ✅ Media processing status tracking
- ✅ Orphaned media cleanup job
- ✅ Proper error handling and rollback

### Media Processing
- ✅ Background worker for:
  - Media validation
  - Thumbnail generation (images and videos)
  - Video transcoding (multiple resolutions)
  - Metadata extraction (dimensions, duration, file size)
  - Status updates in database
- ✅ Job retry logic with exponential backoff
- ✅ Dead-letter queue for failed jobs
- ✅ Processing status: `pending`, `processing`, `ready`, `failed`

### Data Model
- ✅ Post table with all required fields
- ✅ Media/Attachments table with:
  - Status field (uploaded, processing, ready, failed)
  - MIME type
  - File size
  - Dimensions (width, height for images/videos)
  - Duration (for videos)
  - Processing metadata (JSON)
- ✅ Foreign key relationships
- ✅ Proper indexes

### Security
- ✅ S3 bucket policies (no public write)
- ✅ Signed URLs with short TTL (15 minutes)
- ✅ Rate limiting (per user and global)
- ✅ Virus scanning integration point (interface/hook)
- ✅ Content validation and sanitization

### Observability
- ✅ Structured logging
- ✅ Metrics: upload success/failure rates, processing times
- ✅ Queue backlog monitoring
- ✅ Error tracking and alerting

### UX
- ✅ Placeholder while media processing
- ✅ No broken links exposed
- ✅ Graceful error handling with retry UI
- ✅ Optimistic UI updates
- ✅ Loading states

## Files to Review

### Client (Next.js)
- `client/src/components/feed/feedEditor/CreatePostModal.tsx`
- `client/src/components/feed/feedEditor/PhotoEditorModal.tsx`
- `client/src/components/feed/feedEditor/VideoEdit.tsx`
- `client/src/components/feed/feedEditor/Hooks/useMediaUpload.ts`
- `client/src/components/feed/feedEditor/actions/submitPost.ts`
- `client/src/app/api/uploadthing/core.ts`
- `client/src/app/lib/validation.ts`
- `client/src/services/api/feed.service.ts`
- `client/src/components/feed/mutations/useSubmitPostMutation.ts`
- `client/next.config.ts`
- `client/package.json`

### API Gateway
- `api-gateway/src/controllers/feed/main.feed.ts`
- `api-gateway/src/dto/feed.dto.ts`
- `api-gateway/src/middleware/*` (auth, rate-limit, etc.)
- `api-gateway/src/utils/generate.presigned.url.ts`
- `api-gateway/protos/post.proto`

### Post Service
- `post-service/src/services/impliments/post.service.ts`
- `post-service/src/services/impliments/media.service.ts`
- `post-service/src/repositories/impliments/post.repository.ts`
- `post-service/src/repositories/impliments/media.repository.ts`
- `post-service/src/controllers/impliments/comment.controller.ts` (for reference)
- `post-service/src/grpc-server.ts`
- `post-service/protos/post.proto`
- `post-service/prisma/schema.prisma`

### Infrastructure
- `docker-compose.yml`
- `.env.example` or environment variable documentation
- Kafka configuration (if exists)
- Redis configuration (if exists)

## Review Process

1. **Read & Analyze**: Review all listed files
2. **Identify Issues**: Document all problems, anti-patterns, missing features
3. **Prioritize**: Categorize issues by severity (P0, P1, P2, P3)
4. **Design Solutions**: Create architecture diagrams and solution designs
5. **Write Code**: Provide PR-ready code changes
6. **Document**: Create comprehensive documentation
7. **Test**: Provide test examples and test plans

## Expected Output Format

### 1. Executive Summary
- Overall assessment score (0-10)
- Critical issues count
- Estimated effort for fixes

### 2. Detailed Findings
For each issue:
- **Severity**: P0/P1/P2/P3
- **Category**: Security/Performance/UX/etc.
- **Current State**: What's wrong
- **Expected State**: What should be
- **Impact**: What happens if not fixed
- **Solution**: How to fix it
- **Code Changes**: Exact code diffs

### 3. Architecture Recommendations
- Current architecture diagram
- Recommended architecture diagram
- Migration path

### 4. Code Deliverables
- All code files with changes
- Test files
- Configuration files
- Migration scripts

### 5. Documentation
- README for implementation
- Migration guide
- Testing guide
- Deployment guide

---

**Ready to proceed?** Please confirm you have access to all required files and I'll begin the comprehensive review.

