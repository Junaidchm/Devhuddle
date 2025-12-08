# Production-Grade Routing Refactoring Prompt

## Executive Summary

This document provides a comprehensive prompt for refactoring the current routing implementation to follow industrial standard practices used by major tech companies. The refactoring will transform the current ad-hoc routing approach into a production-ready, maintainable, and scalable routing system.

---

## Current Implementation Analysis

### 1. API Gateway Routing Issues

**Current State:**
- **File**: `api-gateway/src/index.ts`
- **Problems Identified:**
  1. **Inconsistent Proxy Routing**: Multiple proxy middlewares routing to the same service with different path patterns:
     - `/auth/google` → `authServiceProxy` (routes to AUTH_SERVICE_URL)
     - `/auth/admin` → `authServiceProxy` (routes to AUTH_SERVICE_URL)
     - `/users` → `userServiveProxy` (routes to AUTH_SERVICE_URL) 
     - `/notifications` → `notificationProxy` (routes to NOTIFICATION_SERVICE_URL)
  
  2. **Inconsistent Path Rewriting**: Different `pathRewrite` patterns across proxies:
     - `authServiceProxy`: `{ "^/auth": "" }` - removes `/auth` prefix
     - `userServiveProxy`: `{ "^/users": "" }` - removes `/users` prefix
     - `notificationProxy`: `{ "^/api/notifications": "" }` - removes `/api/notifications` prefix (but route is `/notifications`)
  
  3. **Mixed Routing Approaches**: Combination of:
     - HTTP proxy middleware for some routes
     - Direct Express routers for others (`/general`, `/auth`, `/feed`)
     - Inconsistent middleware application (some routes have JWT, some don't)
  
  4. **No Route Versioning**: Missing API versioning (`/api/v1/`) which is industry standard
  
  5. **Hardcoded Route Strings**: Routes are string literals scattered throughout the codebase

**Current Proxy Middleware Files:**
- `api-gateway/src/middleware/authserver.proxy.middleware.ts`: Contains `authServiceProxy` and `userServiveProxy`
- `api-gateway/src/middleware/notification.proxy.middleware.ts`: Contains `notificationProxy`
- `api-gateway/src/middleware/jwt.middleware.ts`: JWT authentication middleware

### 2. Auth Service Routing Issues

**Current State:**
- **File**: `auth-service/src/index.ts`
- **Problems Identified:**
  1. **Inconsistent Route Mounting**: Routes mounted at different base paths:
     - `/` → `authRoutes` (contains `/google`, `/google/callback`, `/search`)
     - `/admin` → `adminRoutes`
     - `/profile` → `userRoutes`
     - `/follows` → `followRoutes`
     - `/search` → `authRoutes` (duplicate mounting)
  
  2. **No API Prefix**: Missing `/api` or `/api/v1` prefix
  
  3. **Route Definition Scattered**: Routes defined in multiple files without clear organization

### 3. Notification Service Routing Issues

**Current State:**
- **File**: `notification-service/src/index.ts`
- **Problems Identified:**
  1. **Inconsistent Path Patterns**: Routes mounted at `/notifications` but API Gateway expects different patterns
  2. **No API Versioning**: Missing version prefix
  3. **Path Rewrite Mismatch**: API Gateway proxy rewrites `/api/notifications` but route is `/notifications`

### 4. Frontend Routing Issues

**Current State:**
- **Problems Identified:**
  1. **Hardcoded Routes Everywhere**: Routes are string literals in:
     - `client/auth.ts`: `/auth/login`, `/auth/refresh`
     - `client/src/services/api/*.ts`: Multiple service files with hardcoded paths
     - `client/src/app/actions/*.ts`: Server actions with hardcoded routes
     - `client/src/app/lib/*.ts`: Utility files with hardcoded routes
  
  2. **Inconsistent Base URL Usage**: Multiple ways to get base URL:
     - `process.env.LOCAL_APIGATEWAY_URL`
     - `process.env.PRODUCT_APIGATEWAY_URL`
     - `process.env.API_GATEWAY`
     - `process.env.API_URL`
     - `process.env.NEXT_PUBLIC_API_URL`
  
  3. **No Route Constants**: No centralized route configuration object
  
  4. **Mixed HTTP Clients**: Using both `axios`, `fetch`, and `ky` with different configurations

**Files with Hardcoded Routes:**
- `client/auth.ts`: NextAuth configuration with hardcoded routes
- `client/src/services/api/auth.service.ts`: Auth API calls
- `client/src/services/api/notification.service.ts`: Notification API calls
- `client/src/services/api/follow.service.ts`: Follow API calls
- `client/src/services/api/user.service.ts`: User API calls
- `client/src/services/api/profile.service.ts`: Profile API calls
- `client/src/app/actions/follow.ts`: Server actions with hardcoded routes
- `client/src/components/feed/feedEditor/actions/submitPost.ts`: Post submission
- `client/src/components/feed/feedEditor/actions/deletePost.ts`: Post deletion
- `client/src/app/lib/serverFetch.ts`: Server-side fetch utility
- `client/src/app/lib/ky.ts`: Ky HTTP client wrapper
- `client/src/axios/axios.ts`: Axios instance configuration

---

## Industrial Standard Routing Practices

### 1. **Centralized Route Configuration**
- All routes should be defined in a single source of truth
- Use TypeScript constants/enums for type safety
- Routes should be organized by service/resource
- Example structure:
  ```typescript
  export const API_ROUTES = {
    AUTH: {
      LOGIN: '/api/v1/auth/login',
      SIGNUP: '/api/v1/auth/signup',
      REFRESH: '/api/v1/auth/refresh',
      // ...
    },
    USERS: {
      PROFILE: '/api/v1/users/profile',
      SEARCH: '/api/v1/users/search',
      // ...
    },
    NOTIFICATIONS: {
      LIST: '/api/v1/notifications',
      MARK_READ: '/api/v1/notifications/:id/read',
      // ...
    }
  } as const;
  ```

### 2. **API Versioning**
- All routes should be prefixed with `/api/v1/` (or appropriate version)
- Enables future API evolution without breaking changes
- Industry standard: `/api/v1/{resource}/{action}`

### 3. **Consistent Service-Based Routing**
- Group routes by service/resource
- Use RESTful conventions where applicable
- Consistent path patterns: `/api/v1/{service}/{resource}/{action}`

### 4. **Unified Proxy Configuration**
- Single proxy middleware per service
- Consistent path rewriting rules
- Centralized proxy configuration
- Example:
  ```typescript
  // Instead of multiple proxies, use one per service
  app.use('/api/v1/auth', authServiceProxy);
  app.use('/api/v1/users', authServiceProxy); // if users are in auth service
  app.use('/api/v1/notifications', notificationServiceProxy);
  ```

### 5. **Environment-Based Configuration**
- Single source for base URLs
- Environment-specific configuration
- Type-safe environment variables

### 6. **Type-Safe Route Usage**
- Use TypeScript to ensure route consistency
- Generate route types from constants
- Prevent typos and route mismatches

### 7. **Route Documentation**
- Document route patterns and conventions
- Maintain route registry
- Version migration guides

---

## Refactoring Instructions

### Phase 1: Create Centralized Route Configuration

#### 1.1 API Gateway Route Constants
**Create**: `api-gateway/src/constants/routes.ts`
```typescript
/**
 * Centralized route configuration for API Gateway
 * All routes follow the pattern: /api/v1/{service}/{resource}/{action}
 */

export const API_VERSION = '/api/v1';

export const ROUTES = {
  // Auth Service Routes
  AUTH: {
    BASE: `${API_VERSION}/auth`,
    LOGIN: `${API_VERSION}/auth/login`,
    SIGNUP: `${API_VERSION}/auth/signup`,
    LOGOUT: `${API_VERSION}/auth/logout`,
    REFRESH: `${API_VERSION}/auth/refresh`,
    ME: `${API_VERSION}/auth/me`,
    PROFILE: `${API_VERSION}/auth/profile`,
    VERIFY_OTP: `${API_VERSION}/auth/verify-otp`,
    RESEND_OTP: `${API_VERSION}/auth/resend`,
    PASSWORD_RESET: `${API_VERSION}/auth/password-reset`,
    PASSWORD_RESET_CONFIRM: `${API_VERSION}/auth/password-reset/confirm`,
    GENERATE_PRESIGNED_URL: `${API_VERSION}/auth/generate-presigned-url`,
    GOOGLE_AUTH: `${API_VERSION}/auth/google`,
    GOOGLE_CALLBACK: `${API_VERSION}/auth/google/callback`,
    SEARCH: `${API_VERSION}/auth/search`,
  },
  
  // User Service Routes (handled by Auth Service)
  USERS: {
    BASE: `${API_VERSION}/users`,
    PROFILE_BY_USERNAME: (username: string) => `${API_VERSION}/users/${username}`,
    FOLLOWERS: (username: string) => `${API_VERSION}/users/${username}/followers`,
    FOLLOWING: (username: string) => `${API_VERSION}/users/${username}/following`,
    SEARCH: `${API_VERSION}/users/search`,
  },
  
  // Follow Service Routes (handled by Auth Service)
  FOLLOWS: {
    BASE: `${API_VERSION}/users/follows`,
    SUGGESTIONS: `${API_VERSION}/users/follows/suggestions`,
    FOLLOW: `${API_VERSION}/users/follows/follow`,
    UNFOLLOW: `${API_VERSION}/users/follows/unfollow`,
    FOLLOWERS_INFO: (userId: string) => `${API_VERSION}/users/${userId}/followers`,
  },
  
  // Admin Routes (handled by Auth Service)
  ADMIN: {
    BASE: `${API_VERSION}/auth/admin`,
    USERS: `${API_VERSION}/auth/admin/users`,
    USER_BY_ID: (id: string) => `${API_VERSION}/auth/admin/user/${id}`,
    TOGGLE_USER: (id: string) => `${API_VERSION}/auth/admin/users/${id}/toogle`,
  },
  
  // Notification Service Routes
  NOTIFICATIONS: {
    BASE: `${API_VERSION}/notifications`,
    BY_USER: (userId: string) => `${API_VERSION}/notifications/${userId}`,
    UNREAD_COUNT: (userId: string) => `${API_VERSION}/notifications/${userId}/unread-count`,
    MARK_READ: (id: string) => `${API_VERSION}/notifications/${id}/read`,
    MARK_ALL_READ: (userId: string) => `${API_VERSION}/notifications/${userId}/mark-all-read`,
    DELETE: (id: string) => `${API_VERSION}/notifications/${id}`,
  },
  
  // Health Check
  HEALTH: '/health',
} as const;

// Type helper for route values
export type RouteValue = typeof ROUTES[keyof typeof ROUTES][string] | string;
```

#### 1.2 Frontend Route Constants
**Create**: `client/src/constants/api.routes.ts`
```typescript
/**
 * Centralized API route configuration for frontend
 * Mirrors API Gateway routes for consistency
 */

const API_VERSION = '/api/v1';

export const API_ROUTES = {
  AUTH: {
    LOGIN: `${API_VERSION}/auth/login`,
    SIGNUP: `${API_VERSION}/auth/signup`,
    LOGOUT: `${API_VERSION}/auth/logout`,
    REFRESH: `${API_VERSION}/auth/refresh`,
    ME: `${API_VERSION}/auth/me`,
    PROFILE: `${API_VERSION}/auth/profile`,
    VERIFY_OTP: `${API_VERSION}/auth/verify-otp`,
    RESEND_OTP: `${API_VERSION}/auth/resend`,
    PASSWORD_RESET: `${API_VERSION}/auth/password-reset`,
    PASSWORD_RESET_CONFIRM: `${API_VERSION}/auth/password-reset/confirm`,
    GENERATE_PRESIGNED_URL: `${API_VERSION}/auth/generate-presigned-url`,
    SEARCH: `${API_VERSION}/auth/search`,
  },
  
  USERS: {
    PROFILE_BY_USERNAME: (username: string) => `${API_VERSION}/users/${username}`,
    FOLLOWERS: (username: string) => `${API_VERSION}/users/${username}/followers`,
    FOLLOWING: (username: string) => `${API_VERSION}/users/${username}/following`,
    SEARCH: `${API_VERSION}/users/search`,
  },
  
  FOLLOWS: {
    SUGGESTIONS: `${API_VERSION}/users/follows/suggestions`,
    FOLLOW: `${API_VERSION}/users/follows/follow`,
    UNFOLLOW: `${API_VERSION}/users/follows/unfollow`,
    FOLLOWERS_INFO: (userId: string) => `${API_VERSION}/users/${userId}/followers`,
  },
  
  ADMIN: {
    USERS: `${API_VERSION}/auth/admin/users`,
    USER_BY_ID: (id: string) => `${API_VERSION}/auth/admin/user/${id}`,
    TOGGLE_USER: (id: string) => `${API_VERSION}/auth/admin/users/${id}/toogle`,
  },
  
  NOTIFICATIONS: {
    BY_USER: (userId: string) => `${API_VERSION}/notifications/${userId}`,
    UNREAD_COUNT: (userId: string) => `${API_VERSION}/notifications/${userId}/unread-count`,
    MARK_READ: (id: string) => `${API_VERSION}/notifications/${id}/read`,
    MARK_ALL_READ: (userId: string) => `${API_VERSION}/notifications/${userId}/mark-all-read`,
    DELETE: (id: string) => `${API_VERSION}/notifications/${id}`,
  },
  
  FEED: {
    LIST: `${API_VERSION}/feed/list`,
    SUBMIT: `${API_VERSION}/feed/submit`,
    DELETE: `${API_VERSION}/feed/delete`,
    MEDIA: `${API_VERSION}/feed/media`,
  },
} as const;

// Base URL configuration
export const getApiBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env.LOCAL_APIGATEWAY_URL || process.env.API_GATEWAY || 'http://localhost:8080';
  }
  // Client-side
  return process.env.NEXT_PUBLIC_API_URL || process.env.LOCAL_APIGATEWAY_URL || 'http://localhost:8080';
};
```

### Phase 2: Refactor API Gateway Routing

#### 2.1 Update API Gateway Index
**File**: `api-gateway/src/index.ts`

**Changes Required:**
1. Import route constants
2. Replace hardcoded route strings with constants
3. Consolidate proxy routing to use consistent patterns
4. Apply API versioning prefix `/api/v1`
5. Ensure all routes go through proper middleware chain

**Key Changes:**
```typescript
// Before:
app.use("/auth/google", authServiceProxy);
app.use("/auth/admin", authServiceProxy);
app.use("/users", jwtMiddleware, userServiveProxy);
app.use("/notifications", jwtMiddleware, notificationProxy);

// After:
import { ROUTES } from "./constants/routes";

// Auth service routes (public and protected)
app.use(ROUTES.AUTH.BASE, authServiceProxy); // Handles all /api/v1/auth/* routes

// User routes (protected)
app.use(ROUTES.USERS.BASE, jwtMiddleware, authServiceProxy); // Routes to auth service

// Notification routes (protected)
app.use(ROUTES.NOTIFICATIONS.BASE, jwtMiddleware, notificationServiceProxy);
```

#### 2.2 Refactor Proxy Middleware
**File**: `api-gateway/src/middleware/authserver.proxy.middleware.ts`

**Changes Required:**
1. Create unified proxy for auth service
2. Update pathRewrite to handle `/api/v1` prefix correctly
3. Remove duplicate proxy configurations
4. Ensure consistent path rewriting

**Key Changes:**
```typescript
// Unified proxy for Auth Service
export const authServiceProxy = createProxyMiddleware({
  target: process.env.AUTH_SERVICE_URL!,
  changeOrigin: true,
  pathRewrite: { 
    "^/api/v1": "" // Remove /api/v1, keep /auth, /users, etc.
  },
  // ... rest of configuration
});

// Remove userServiveProxy - use authServiceProxy for both /auth and /users
```

**File**: `api-gateway/src/middleware/notification.proxy.middleware.ts`

**Changes Required:**
1. Fix pathRewrite to match actual route pattern
2. Ensure WebSocket support is maintained
3. Update to handle `/api/v1/notifications` prefix

**Key Changes:**
```typescript
export const notificationServiceProxy = createProxyMiddleware({
  target: app_config.notificationServiceUrl,
  changeOrigin: true,
  ws: true,
  pathRewrite: { 
    "^/api/v1/notifications": "/notifications" // Correct path rewrite
  },
  // ... rest of configuration
});
```

### Phase 3: Refactor Auth Service Routing

#### 3.1 Update Auth Service Index
**File**: `auth-service/src/index.ts`

**Changes Required:**
1. Add `/api/v1` prefix to all routes
2. Consolidate route mounting
3. Remove duplicate route mounting
4. Ensure consistent path patterns

**Key Changes:**
```typescript
// Before:
app.use("/", authRoutes);
app.use("/admin", adminRoutes);
app.use("/profile", userRoutes);
app.use("/follows", followRoutes);
app.use("/search", authRoutes); // Duplicate!

// After:
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/auth/admin`, adminRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/users/follows`, followRoutes);
```

#### 3.2 Update Auth Service Route Files
**Files**: `auth-service/src/routes/*.ts`

**Changes Required:**
1. Update route definitions to match new structure
2. Ensure routes align with API Gateway expectations
3. Remove conflicting route definitions

### Phase 4: Refactor Notification Service Routing

#### 4.1 Update Notification Service Index
**File**: `notification-service/src/index.ts`

**Changes Required:**
1. Add `/api/v1` prefix
2. Ensure routes match API Gateway proxy configuration
3. Maintain WebSocket route compatibility

**Key Changes:**
```typescript
// Before:
app.use("/notifications", notificationRoutes);

// After:
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/notifications`, notificationRoutes);
```

### Phase 5: Refactor Frontend Routing

#### 5.1 Update All Service Files
**Files**: `client/src/services/api/*.ts`

**Changes Required:**
1. Import `API_ROUTES` from constants
2. Replace all hardcoded route strings with constants
3. Use `getApiBaseUrl()` for base URL

**Example for `auth.service.ts`:**
```typescript
// Before:
const response = await axiosInstance.post("/auth/login", data);

// After:
import { API_ROUTES, getApiBaseUrl } from "@/src/constants/api.routes";
const response = await axiosInstance.post(API_ROUTES.AUTH.LOGIN, data);
```

#### 5.2 Update Server Actions
**Files**: `client/src/app/actions/*.ts`

**Changes Required:**
1. Import `API_ROUTES` from constants
2. Replace hardcoded routes
3. Use route helper functions for dynamic routes

**Example for `follow.ts`:**
```typescript
// Before:
const data = await api.get(`auth/${userId}/followers`).json<FollowerInfo>();

// After:
import { API_ROUTES } from "@/src/constants/api.routes";
const data = await api.get(API_ROUTES.FOLLOWS.FOLLOWERS_INFO(userId)).json<FollowerInfo>();
```

#### 5.3 Update NextAuth Configuration
**File**: `client/auth.ts`

**Changes Required:**
1. Use route constants
2. Use `getApiBaseUrl()` for base URL

**Key Changes:**
```typescript
// Before:
const res = await fetch(
  `${process.env.LOCAL_APIGATEWAY_URL}/auth/login`,
  // ...
);

// After:
import { API_ROUTES, getApiBaseUrl } from "./src/constants/api.routes";
const res = await fetch(
  `${getApiBaseUrl()}${API_ROUTES.AUTH.LOGIN}`,
  // ...
);
```

#### 5.4 Update HTTP Client Utilities
**Files**: 
- `client/src/axios/axios.ts`
- `client/src/app/lib/ky.ts`
- `client/src/app/lib/serverFetch.ts`
- `client/src/app/lib/api.ts`

**Changes Required:**
1. Use `getApiBaseUrl()` consistently
2. Remove hardcoded base URLs
3. Ensure all clients use the same base URL source

### Phase 6: Testing & Validation

#### 6.1 Verify All Routes
1. Test all authentication flows
2. Test all user operations
3. Test all notification operations
4. Test all follow operations
5. Verify WebSocket connections still work
6. Test admin routes

#### 6.2 Check for Breaking Changes
1. Ensure no routes are broken
2. Verify middleware chain is correct
3. Check path rewriting works correctly
4. Validate API versioning is applied consistently

---

## Implementation Checklist

### API Gateway
- [ ] Create `api-gateway/src/constants/routes.ts` with route constants
- [ ] Update `api-gateway/src/index.ts` to use route constants
- [ ] Refactor `authserver.proxy.middleware.ts` to unified proxy
- [ ] Update `notification.proxy.middleware.ts` path rewriting
- [ ] Remove duplicate proxy configurations
- [ ] Apply `/api/v1` prefix to all routes
- [ ] Test all proxy routes work correctly

### Auth Service
- [ ] Update `auth-service/src/index.ts` route mounting
- [ ] Add `/api/v1` prefix to all routes
- [ ] Update route files to match new structure
- [ ] Remove duplicate route mounting
- [ ] Test all auth service routes

### Notification Service
- [ ] Update `notification-service/src/index.ts` route mounting
- [ ] Add `/api/v1` prefix to routes
- [ ] Verify WebSocket routes still work
- [ ] Test all notification routes

### Frontend
- [ ] Create `client/src/constants/api.routes.ts` with route constants
- [ ] Create `getApiBaseUrl()` utility function
- [ ] Update `client/auth.ts` to use route constants
- [ ] Update all service files in `client/src/services/api/`
- [ ] Update all server actions in `client/src/app/actions/`
- [ ] Update HTTP client utilities (axios, ky, serverFetch)
- [ ] Remove all hardcoded route strings
- [ ] Test all frontend API calls

### Validation
- [ ] All routes work correctly
- [ ] No breaking changes
- [ ] Type safety maintained
- [ ] Environment variables configured correctly
- [ ] WebSocket connections work
- [ ] Authentication flows work
- [ ] All services communicate correctly

---

## Expected Outcomes

After implementing this refactoring:

1. **Centralized Route Management**: All routes defined in one place, easy to maintain and update
2. **Type Safety**: TypeScript ensures route consistency across codebase
3. **Consistency**: All routes follow the same pattern: `/api/v1/{service}/{resource}/{action}`
4. **Maintainability**: Changes to routes only need to be made in constants files
5. **Scalability**: Easy to add new routes and services following established patterns
6. **Production Ready**: Follows industry standards used by major tech companies
7. **No Hardcoded Routes**: All routes use constants, preventing typos and inconsistencies
8. **API Versioning**: Proper versioning allows for future API evolution
9. **Environment Flexibility**: Single source for base URLs, easy to configure for different environments

---

## Notes

- **DO NOT** modify gRPC routes - only HTTP routes should be refactored
- **DO NOT** break existing functionality - all routes must continue to work
- **DO** maintain backward compatibility during transition if needed
- **DO** test thoroughly after each phase
- **DO** document any route changes for team reference

---

## Additional Best Practices to Implement

1. **Route Documentation**: Create OpenAPI/Swagger documentation for all routes
2. **Route Testing**: Add integration tests for all routes
3. **Route Monitoring**: Add logging/monitoring for route usage
4. **Route Validation**: Add request validation middleware
5. **Rate Limiting**: Apply rate limiting per route/service
6. **Error Handling**: Consistent error responses across all routes

---

This prompt provides a complete roadmap for transforming the current routing implementation into a production-grade, industrial standard routing system that will scale with your project's growth.

