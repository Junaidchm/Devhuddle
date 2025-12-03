# API Gateway gRPC → HTTP Proxy Migration Plan

## 📋 Executive Summary

This document outlines the complete migration plan to remove all gRPC usage from the API Gateway and replace it with HTTP proxy calls to microservices. The API Gateway will become a pure HTTP reverse proxy, following production-ready microservice architecture patterns.

---

## 🔍 Current State Analysis

### gRPC Usage in API Gateway

#### 1. **Auth Service Operations (via gRPC)**
Located in: `api-gateway/src/controllers/auth.controller.ts`
- ✅ `signup` → `register` gRPC call
- ✅ `verifyOtp` → `verifyOtp` gRPC call
- ✅ `resendOtp` → `resendOtp` gRPC call
- ✅ `getMe` → `getJwtUser` gRPC call
- ✅ `login` → `login` gRPC call
- ✅ `logout` → (no gRPC, local logic)
- ✅ `requestPasswordReset` → `requestPasswordReset` gRPC call
- ✅ `confirmPasswordReset` → `resetPassword` gRPC call
- ✅ `getProfile` → `getProfile` gRPC call
- ✅ `updateProfile` → `updateProfile` gRPC call
- ✅ `refreshToken` → `verifyRefreshToken` gRPC call
- ✅ `generatePresignedUrl` → `generatePresignedUrl` gRPC call

#### 2. **Feed Service Operations (via gRPC)**
Located in: `api-gateway/src/controllers/feed/main.feed.ts`
- ✅ `createPost` → `submitPost` gRPC call
- ✅ `listPost` → `listPosts` gRPC call
- ✅ `uploadMedia` → `uploadMedia` gRPC call
- ✅ `deletePost` → `deletePost` gRPC call
- ✅ `deleteUnuseMedias` → `deleteUnusedMedias` gRPC call

#### 3. **gRPC Infrastructure Files**
- `api-gateway/src/config/grpc.client.ts` - gRPC client instances
- `api-gateway/src/utils/grpc.helper.ts` - gRPC helper functions
- `api-gateway/src/utils/grpcControllerHandler.ts` - gRPC controller wrapper
- `api-gateway/src/utils/grpcResilience.util.ts` - gRPC circuit breaker
- `api-gateway/src/grpc/generated/` - Generated proto files
- `api-gateway/src/generate.ts` - Proto generation script
- `api-gateway/protos/` - Proto definition files

#### 4. **Routes Using gRPC**
- `api-gateway/src/routes/authservice/auth.routes.ts` - All auth routes
- `api-gateway/src/routes/feedService/feed.routes.ts` - All feed routes
- `api-gateway/src/routes/generalservice/general.routes.ts` - General routes

---

## 🎯 Target State

### API Gateway Structure
```
api-gateway/
  src/
    controllers/          # REMOVE (no direct controllers)
    routes/              # REMOVE (use proxy middleware)
    services/            # NEW: HTTP proxy services
      auth-service.http.ts
      post-service.http.ts
    middleware/          # KEEP: Proxy middleware
    config/              # REMOVE: grpc.client.ts
    utils/               # REMOVE: grpc.helper.ts, grpcControllerHandler.ts
    grpc/                # REMOVE: Entire directory
```

### Microservices HTTP Endpoints

#### Auth Service (`/auth/*`)
- `POST /auth/signup`
- `POST /auth/verify-otp`
- `POST /auth/resend`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/profile`
- `PATCH /auth/profile`
- `POST /auth/refresh`
- `POST /auth/password-reset`
- `POST /auth/password-reset/confirm`
- `POST /auth/generate-presigned-url`

#### Post Service (`/api/v1/posts/*`)
- `POST /api/v1/posts/submit`
- `GET /api/v1/posts/list`
- `POST /api/v1/posts/media`
- `DELETE /api/v1/posts/:postId`
- `DELETE /api/v1/posts/medias/unused`

---

## 📝 Implementation Steps

### Phase 1: Create HTTP Endpoints in Microservices

#### Step 1.1: Auth Service HTTP Routes
**File**: `auth-service/src/routes/auth.routes.ts`

Add HTTP route handlers that wrap existing controller methods:
```typescript
router
  .post("/signup", async (req, res) => {
    const controller = new AuthController(authService);
    const response = await controller.register(req.body);
    res.status(201).json(response);
  })
  .post("/verify-otp", async (req, res) => {
    // ... wrap verifyOTP
  })
  // ... all other routes
```

#### Step 1.2: Post Service HTTP Routes
**File**: `post-service/src/routes/feed.routes.ts` (NEW)

Create new route file for feed operations:
```typescript
router
  .post("/submit", async (req, res) => {
    const controller = new PostController(postService);
    const response = await controller.submitPostController(req.body);
    res.status(200).json({ success: true, data: response });
  })
  // ... all other routes
```

### Phase 2: Create HTTP Proxy Services in API Gateway

#### Step 2.1: Auth Service HTTP Proxy
**File**: `api-gateway/src/services/auth-service.http.ts` (NEW)

```typescript
import axios from 'axios';
import { app_config } from '../config/app.config';

const AUTH_SERVICE_URL = app_config.authServiceUrl;

export const authServiceHttp = {
  async signup(data: RegisterRequest) {
    return axios.post(`${AUTH_SERVICE_URL}/auth/signup`, data);
  },
  // ... all other methods
};
```

#### Step 2.2: Post Service HTTP Proxy
**File**: `api-gateway/src/services/post-service.http.ts` (NEW)

```typescript
import axios from 'axios';
import { app_config } from '../config/app.config';

const POST_SERVICE_URL = app_config.postServiceUrl;

export const postServiceHttp = {
  async submitPost(data: SubmitPostRequest) {
    return axios.post(`${POST_SERVICE_URL}/api/v1/posts/submit`, data);
  },
  // ... all other methods
};
```

### Phase 3: Replace gRPC Calls in API Gateway

#### Step 3.1: Update Auth Routes
**File**: `api-gateway/src/index.ts`

Change from:
```typescript
app.use("/auth", authRouter);  // Direct gRPC routes
```

To:
```typescript
app.use(ROUTES.AUTH.BASE, conditionalJwtMiddleware, authServiceProxy);  // HTTP proxy
```

#### Step 3.2: Update Feed Routes
**File**: `api-gateway/src/index.ts`

Change from:
```typescript
app.use(ROUTES.FEED.BASE, feedRouter);  // Direct gRPC routes
```

To:
```typescript
// Create new postServiceProxy middleware
app.use(ROUTES.FEED.BASE, conditionalJwtMiddleware, postServiceProxy);
```

### Phase 4: Cleanup gRPC Code

#### Step 4.1: Remove Files
- ❌ `api-gateway/src/config/grpc.client.ts`
- ❌ `api-gateway/src/utils/grpc.helper.ts`
- ❌ `api-gateway/src/utils/grpcControllerHandler.ts`
- ❌ `api-gateway/src/utils/grpcResilience.util.ts`
- ❌ `api-gateway/src/controllers/auth.controller.ts`
- ❌ `api-gateway/src/controllers/feed/main.feed.ts`
- ❌ `api-gateway/src/routes/authservice/auth.routes.ts`
- ❌ `api-gateway/src/routes/feedService/feed.routes.ts`
- ❌ `api-gateway/src/grpc/` (entire directory)
- ❌ `api-gateway/protos/` (entire directory)
- ❌ `api-gateway/src/generate.ts`

#### Step 4.2: Update package.json
Remove gRPC dependencies:
- `@grpc/grpc-js`
- `@grpc/proto-loader`
- `google-protobuf`
- `protoc-gen-ts`
- `ts-proto`

Add HTTP client (if not using axios):
- `axios` (or use native fetch)

---

## ✅ Verification Checklist

- [ ] All auth endpoints work via HTTP proxy
- [ ] All feed endpoints work via HTTP proxy
- [ ] No gRPC imports in API Gateway
- [ ] No proto files in API Gateway
- [ ] API Gateway package.json has no gRPC deps
- [ ] All existing frontend calls still work
- [ ] Error handling works correctly
- [ ] JWT middleware still works
- [ ] Rate limiting still works
- [ ] Logging still works

---

## 🔒 Backward Compatibility

- ✅ All existing frontend API calls will continue to work
- ✅ Request/response formats remain the same
- ✅ Error codes and messages remain the same
- ✅ Authentication flow remains the same
- ✅ Only the transport layer changes (gRPC → HTTP)

---

## 🚀 Benefits

1. **Production-Ready Architecture**: Follows industry best practices (Netflix, Uber, LinkedIn)
2. **Simpler API Gateway**: Pure HTTP reverse proxy, no protocol translation
3. **Better Observability**: Standard HTTP logs, metrics, tracing
4. **Easier Debugging**: Standard HTTP tools work (curl, Postman, browser dev tools)
5. **Flexibility**: Can easily add load balancing, caching, rate limiting at HTTP level
6. **Maintainability**: No proto file management in API Gateway

---

## ⚠️ Important Notes

- **DO NOT** remove gRPC from microservices - it's still used for service-to-service communication
- **DO NOT** change business logic - only transport layer
- **DO NOT** modify request/response structures
- **KEEP** gRPC for internal microservice communication
- **KEEP** Kafka event system as-is

---

## 📅 Implementation Order

1. ✅ Create HTTP endpoints in auth-service
2. ✅ Create HTTP endpoints in post-service
3. ✅ Test HTTP endpoints directly
4. ✅ Create HTTP proxy services in API Gateway
5. ✅ Update API Gateway routes to use HTTP proxy
6. ✅ Test all endpoints through API Gateway
7. ✅ Remove gRPC code from API Gateway
8. ✅ Update documentation

---

## 🎯 Success Criteria

- [ ] Zero gRPC code in API Gateway
- [ ] All endpoints work via HTTP proxy
- [ ] No breaking changes for frontend
- [ ] All tests pass
- [ ] Code is production-ready
