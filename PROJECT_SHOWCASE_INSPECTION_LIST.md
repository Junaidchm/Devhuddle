# Project Showcasing Feature - File Inspection List

## ✅ CONFIRMATION REQUIRED

Before implementing the Project Showcasing feature, I need to inspect the following files and directories to understand your complete architecture and patterns.

---

## 📋 FILES TO INSPECT

### 1. **DATABASE SCHEMAS (Prisma)**
- [ ] `post-service/prisma/schema.prisma` - Understand existing models (Posts, Media, Comments, Reactions, Reports, OutboxEvent, IdempotencyKey)
- [ ] `auth-service/prisma/schema.prisma` - User model, Follow relationships
- [ ] `notification-service/prisma/schema.prisma` - Notification patterns

### 2. **BACKEND MICROSERVICES - POST SERVICE** (Reference for patterns)
- [ ] `post-service/src/services/impliments/post.service.ts` - Post creation patterns
- [ ] `post-service/src/services/impliments/comment.service.ts` - Comment patterns, permission checks
- [ ] `post-service/src/services/impliments/like.service.ts` - Like/reaction patterns
- [ ] `post-service/src/services/impliments/share.service.ts` - Share patterns
- [ ] `post-service/src/services/impliments/media.service.ts` - Media upload patterns
- [ ] `post-service/src/repositories/impliments/post.repository.ts` - Repository patterns
- [ ] `post-service/src/repositories/impliments/comment.repository.ts` - Repository patterns
- [ ] `post-service/src/repositories/impliments/media.repository.ts` - Media repository patterns
- [ ] `post-service/src/controllers/impliments/comment.controller.ts` - Controller patterns
- [ ] `post-service/src/middlewares/idempotency.middleware.ts` - Idempotency implementation
- [ ] `post-service/src/services/impliments/outbox.processor.ts` - Event publishing patterns
- [ ] `post-service/src/utils/redis.util.ts` - Redis caching patterns
- [ ] `post-service/src/config/kafka.config.ts` - Kafka topic configuration
- [ ] `post-service/src/grpc-server.ts` - gRPC server setup
- [ ] `post-service/protos/post.proto` - gRPC service definitions

### 3. **API GATEWAY**
- [ ] `api-gateway/src/controllers/feed/main.feed.ts` - API Gateway controller patterns
- [ ] `api-gateway/src/middleware/*` - Auth, rate limiting, caching middleware
- [ ] `api-gateway/src/utils/generate.presigned.url.ts` - S3 presigned URL generation
- [ ] `api-gateway/src/routes/*` - Route definitions
- [ ] `api-gateway/src/config/grpc.client.ts` - gRPC client configuration
- [ ] `api-gateway/protos/post.proto` - gRPC proto definitions

### 4. **NOTIFICATION SERVICE** (For event consumption)
- [ ] `notification-service/src/consumers/engagement.consumer.ts` - Event consumption patterns
- [ ] `notification-service/src/consumers/follow.consumer.ts` - Follow event patterns
- [ ] `notification-service/src/repository/impliments/notifications.repository.ts` - Notification repository
- [ ] `notification-service/src/services/*` - Notification service patterns

### 5. **AUTH SERVICE** (For user resolution)
- [ ] `auth-service/src/services/impliments/auth.service.ts` - User profile patterns
- [ ] `auth-service/src/grpc-server.ts` - gRPC server patterns
- [ ] `auth-service/protos/user.proto` - User service proto

### 6. **FRONTEND - NEXT.JS 15 CLIENT**
- [ ] `client/src/components/feed/feedEditor/CreatePostModal.tsx` - Post creation UI patterns
- [ ] `client/src/components/feed/feedEditor/CommentSection.tsx` - Comment UI patterns
- [ ] `client/src/components/feed/feedEditor/Hooks/useMediaUpload.ts` - Media upload hooks
- [ ] `client/src/components/feed/feedEditor/actions/submitPost.ts` - Server action patterns
- [ ] `client/src/app/lib/serverFetch.ts` - Server-side fetch patterns
- [ ] `client/src/app/lib/validation.ts` - Validation schemas
- [ ] `client/src/app/lib/general/getPresignedUrl.ts` - Presigned URL client patterns
- [ ] `client/src/app/lib/general/uploadToS3WithProgressTracking.ts` - S3 upload patterns
- [ ] `client/src/services/api/feed.service.ts` - API service patterns
- [ ] `client/src/components/feed/mutations/useSubmitPostMutation.ts` - React Query mutation patterns
- [ ] `client/src/constants/api.routes.ts` - API route constants
- [ ] `client/src/app/(main)/page.tsx` - Home page structure
- [ ] `client/src/app/(main)/profile/[user_name]/page.tsx` - Profile page patterns
- [ ] `client/src/app/actions/follow.ts` - Server action examples

### 7. **INFRASTRUCTURE & CONFIG**
- [ ] `docker-compose.yml` - Service orchestration, ports, dependencies
- [ ] `post-service/package.json` - Dependencies, scripts
- [ ] `client/package.json` - Frontend dependencies
- [ ] `api-gateway/package.json` - Gateway dependencies
- [ ] `.env.example` files (if exist) - Environment variable patterns

### 8. **EXISTING PROMPTS & DOCUMENTATION** (For context)
- [ ] `POST_CREATION_PRODUCTION_REVIEW_PROMPT.md` - Understanding production standards
- [ ] `FEED_ARCHITECTURE_REFACTOR_PROMPT.md` - Architecture patterns
- [ ] `COMPLETE_LINKEDIN_COMMENT_SYSTEM_PROMPT.md` - Comment system patterns

---

## 🔍 ADDITIONAL INFRASTRUCTURE ACCESS NEEDED

Please confirm access to or provide configuration for:

1. **S3 Configuration**
   - [ ] AWS S3 bucket name and region
   - [ ] S3 access key ID and secret (or IAM role)
   - [ ] S3 bucket policies for presigned URLs
   - [ ] CDN configuration (CloudFront) if used

2. **Redis Configuration**
   - [ ] Redis connection string/host
   - [ ] Redis password (if required)
   - [ ] Redis database number for project showcase cache

3. **Kafka Configuration**
   - [ ] Kafka broker addresses
   - [ ] Topic naming conventions
   - [ ] Consumer group patterns

4. **Database**
   - [ ] PostgreSQL connection strings for each service
   - [ ] Database migration strategy (migrate deploy vs db push)

5. **Environment Variables**
   - [ ] Required env vars for new `project-service`
   - [ ] Service discovery configuration (if used)

---

## 📝 INSPECTION GOALS

After inspecting these files, I will:

1. ✅ Understand your exact code patterns and conventions
2. ✅ Match the existing architecture (Repository → Service → Controller → gRPC)
3. ✅ Reuse existing utilities (Redis, Kafka, Outbox, Idempotency)
4. ✅ Follow your frontend patterns (Next.js 15, React Query, Server Actions)
5. ✅ Integrate with existing services (auth, notification, post)
6. ✅ Create a new `project-service` microservice following your patterns
7. ✅ Generate production-ready code matching your codebase style

---

## ⏳ NEXT STEPS

**Please confirm:**
1. ✅ You grant access to inspect all listed files
2. ✅ You can provide S3/Redis/Kafka configuration details (or confirm they're in .env files)
3. ✅ You want me to proceed with full codebase analysis and then create the implementation prompt

**After confirmation, I will:**
1. Read and analyze all listed files
2. Create a comprehensive, production-ready implementation prompt
3. The prompt will include:
   - Complete ERD for Project Showcasing
   - Event topology (Kafka topics, events)
   - API specifications (gRPC + REST)
   - Frontend component structure
   - Database migration files
   - Worker/queue configurations
   - Security and validation requirements
   - Testing strategy

---

**Status: ⏳ Waiting for your confirmation before proceeding**

