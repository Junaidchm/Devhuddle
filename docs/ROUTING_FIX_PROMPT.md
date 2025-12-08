# Critical Routing Fix Prompt

## Problem Analysis

### Current Issues Identified:

1. **gRPC vs HTTP Route Confusion**
   - **Problem**: Login, signup, verify-otp, resend-otp, password-reset routes are handled by **gRPC** via `authRouter` at `/auth/*`
   - **Current State**: These routes are accessible at `/auth/login`, `/auth/signup`, etc. (gRPC routes)
   - **Mistake**: Applied JWT middleware to `/api/v1/auth/*` proxy, which blocks public routes
   - **Impact**: Login/signup broken because JWT middleware blocks public routes

2. **Multiple Proxies to Same Service**
   - **Problem**: Multiple proxy routes pointing to auth service:
     - `/api/v1/auth/google` → separate proxy
     - `/api/v1/auth/google/callback` → separate proxy  
     - `/api/v1/auth/*` → proxy with JWT (WRONG - blocks public routes)
     - `/api/v1/users/*` → proxy with JWT
   - **Impact**: Not industrial standard, hard to maintain, inconsistent

3. **Public vs Protected Routes Not Separated**
   - **Problem**: JWT middleware applied to ALL `/api/v1/auth/*` routes
   - **Reality**: 
     - Public routes: login, signup, verify-otp, resend-otp, password-reset (gRPC at `/auth/*`)
     - Protected routes: me, profile, logout, refresh, generate-presigned-url (gRPC at `/auth/*`)
     - HTTP routes: Google OAuth, search, users, admin (should go through proxy)

4. **Route Structure Confusion**
   - **gRPC Routes** (via `authRouter` at `/auth/*`):
     - `/auth/login` - PUBLIC (gRPC)
     - `/auth/signup` - PUBLIC (gRPC)
     - `/auth/verify-otp` - PUBLIC (gRPC)
     - `/auth/resend` - PUBLIC (gRPC)
     - `/auth/password-reset` - PUBLIC (gRPC)
     - `/auth/password-reset/confirm` - PUBLIC (gRPC)
     - `/auth/me` - PROTECTED (gRPC, has JWT middleware in router)
     - `/auth/logout` - PROTECTED (gRPC, has JWT middleware in router)
     - `/auth/profile` - PROTECTED (gRPC, has JWT middleware in router)
     - `/auth/refresh` - PROTECTED (gRPC, has refreshToken middleware)
     - `/auth/generate-presigned-url` - PROTECTED (gRPC, has JWT middleware)
   
   - **HTTP Routes** (should go through proxy to auth service):
     - `/api/v1/auth/google` - PUBLIC (HTTP, OAuth)
     - `/api/v1/auth/google/callback` - PUBLIC (HTTP, OAuth)
     - `/api/v1/auth/search` - PROTECTED (HTTP, needs JWT)
     - `/api/v1/users/*` - PROTECTED (HTTP, needs JWT)
     - `/api/v1/auth/admin/*` - PROTECTED (HTTP, needs JWT)

## Solution Requirements

### 1. Separate gRPC Routes from HTTP Proxy Routes
   - **gRPC routes** (`/auth/*`): Keep as direct Express router, NO proxy
   - **HTTP routes** (`/api/v1/*`): Use unified proxy to auth service

### 2. Unified Proxy for Auth Service
   - **ONE proxy** for all HTTP routes to auth service
   - Handle both public and protected routes in the proxy
   - Use conditional JWT middleware (skip for public routes)

### 3. Proper Route Organization
   ```
   /auth/*                    → gRPC routes (direct Express router)
   /api/v1/auth/google        → HTTP proxy (public, no JWT)
   /api/v1/auth/google/callback → HTTP proxy (public, no JWT)
   /api/v1/auth/search        → HTTP proxy (protected, JWT required)
   /api/v1/users/*            → HTTP proxy (protected, JWT required)
   /api/v1/auth/admin/*       → HTTP proxy (protected, JWT required)
   /api/v1/notifications/*    → HTTP proxy (protected, JWT required)
   ```

### 4. Conditional JWT Middleware
   - Create middleware that skips JWT for public routes
   - Apply JWT only to protected routes
   - Public HTTP routes: Google OAuth, Google Callback
   - Protected HTTP routes: search, users, admin, notifications

## Implementation Steps

### Step 1: Create Conditional JWT Middleware
   - Create middleware that checks if route is public
   - Skip JWT validation for public routes
   - Apply JWT validation for protected routes

### Step 2: Consolidate Auth Service Proxy
   - Remove separate Google OAuth proxy routes
   - Use ONE unified proxy for all HTTP routes to auth service
   - Routes: /api/v1/auth/google, /api/v1/auth/google/callback, /api/v1/auth/search, /api/v1/users/*, /api/v1/auth/admin/*

### Step 3: Fix Route Ordering
   - Public routes must come before protected routes
   - gRPC routes (`/auth/*`) should remain separate
   - HTTP proxy routes should use unified proxy with conditional JWT

### Step 4: Update Route Constants
   - Ensure route constants match actual route structure
   - Separate gRPC routes from HTTP routes in documentation

## Expected Outcome

1. ✅ Login/signup work (gRPC routes at `/auth/*` remain unchanged)
2. ✅ Public HTTP routes work without JWT (Google OAuth)
3. ✅ Protected HTTP routes require JWT (search, users, admin)
4. ✅ ONE unified proxy for all HTTP routes to auth service
5. ✅ No breaking changes to existing functionality
6. ✅ Industrial standard routing pattern

