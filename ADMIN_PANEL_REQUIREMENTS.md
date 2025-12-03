# Admin Panel Requirements - Essential Features Only

## 📋 Executive Summary

Based on comprehensive analysis of your codebase, this document lists **ONLY the essential admin features** you must implement to make your platform production-ready. No bloat, no unnecessary features—just what's required for content moderation and user management.

---

## 🔍 What Already Exists

### ✅ **User Management (Partial)**
- View all users with pagination, search, filtering
- Block/unblock users
- View user details
- Admin dashboard UI (with hardcoded data)

### ✅ **Reporting System (Fully Implemented)**
- Users can report posts and comments
- Report model with:
  - Status: `PENDING`, `OPEN`, `INVESTIGATING`, `RESOLVED_APPROVED`, `RESOLVED_REMOVED`, `RESOLVED_IGNORED`, `CLOSED`
  - Severity: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
  - Reasons: `SPAM`, `INAPPROPRIATE`, `HARASSMENT`, `HATE_SPEECH`, `VIOLENCE`, `SELF_HARM`, `FALSE_INFORMATION`, `COPYRIGHT_VIOLATION`, `OTHER`
  - Fields: `reviewedById`, `reviewedAt`, `resolution`, `description`, `metadata`

### ✅ **Post Moderation Fields**
- `isHidden`, `hiddenAt`, `hiddenReason` (for hiding posts)
- `deletedAt` (soft delete)
- `reportsCount` (denormalized counter)

### ✅ **Comment Moderation Fields**
- `deletedAt` (soft delete)
- Reports relation

### ❌ **Missing Admin Features**
- No admin endpoints to manage reports
- No admin endpoints to manage posts
- No admin endpoints to manage comments
- No real analytics endpoints (dashboard has hardcoded data)

---

## 🎯 Essential Admin Features to Implement

### 1. **Report Management** ⚠️ **CRITICAL**

**Why:** Your reporting system is fully built, but admins have no way to view or act on reports.

#### 1.1 List Reports
- **Endpoint:** `GET /api/v1/admin/reports`
- **Query Params:**
  - `page`, `limit` (pagination)
  - `status` (filter by: `PENDING`, `OPEN`, `INVESTIGATING`, `RESOLVED_*`, `CLOSED`)
  - `targetType` (filter by: `POST`, `COMMENT`)
  - `severity` (filter by: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
  - `reason` (filter by report reason)
  - `sortBy` (`createdAt`, `severity`, `status`)
- **Response:** Paginated list of reports with:
  - Report details (id, reason, severity, status, description)
  - Reporter info (id, username, email)
  - Target content (post/comment preview, author info)
  - Review history (reviewedBy, reviewedAt, resolution)

#### 1.2 Get Report Details
- **Endpoint:** `GET /api/v1/admin/reports/:reportId`
- **Response:** Full report details including:
  - All report fields
  - Reporter full info
  - Target content (full post/comment with author)
  - All reports for same target (if multiple reports)
  - Review history

#### 1.3 Take Action on Report
- **Endpoint:** `PATCH /api/v1/admin/reports/:reportId/action`
- **Body:**
  ```json
  {
    "action": "APPROVE" | "REMOVE" | "IGNORE",
    "resolution": "string (admin notes)",
    "hideContent": boolean,  // If true, hide the post/comment
    "suspendUser": boolean    // If true, suspend the content author
  }
  ```
- **Actions:**
  - `APPROVE`: Mark report as resolved, content stays
  - `REMOVE`: Delete/hide the reported content
  - `IGNORE`: Dismiss the report
- **Side Effects:**
  - Update report status to `RESOLVED_APPROVED`, `RESOLVED_REMOVED`, or `RESOLVED_IGNORED`
  - Set `reviewedById`, `reviewedAt`, `resolution`
  - If `hideContent`: Set `isHidden=true` on post/comment, set `hiddenAt`, `hiddenReason`
  - If `suspendUser`: Call user block endpoint

#### 1.4 Bulk Actions on Reports
- **Endpoint:** `POST /api/v1/admin/reports/bulk-action`
- **Body:**
  ```json
  {
    "reportIds": ["id1", "id2", ...],
    "action": "APPROVE" | "REMOVE" | "IGNORE",
    "resolution": "string"
  }
  ```

---

### 2. **Post Management** ⚠️ **CRITICAL**

**Why:** Admins need to view, moderate, and remove posts that violate policies.

#### 2.1 List All Posts
- **Endpoint:** `GET /api/v1/admin/posts`
- **Query Params:**
  - `page`, `limit` (pagination)
  - `status` (filter by: `all`, `reported`, `hidden`, `deleted`)
  - `userId` (filter by author)
  - `search` (search in content)
  - `sortBy` (`createdAt`, `reportsCount`, `likesCount`)
- **Response:** Paginated list of posts with:
  - Post content, author, engagement metrics
  - `reportsCount`, `isHidden`, `deletedAt`
  - Media attachments

#### 2.2 Get Post Details
- **Endpoint:** `GET /api/v1/admin/posts/:postId`
- **Response:** Full post details including:
  - All post fields
  - Author info
  - All reports for this post
  - Comments count
  - Media attachments

#### 2.3 Hide/Unhide Post
- **Endpoint:** `PATCH /api/v1/admin/posts/:postId/hide`
- **Body:**
  ```json
  {
    "hidden": boolean,
    "reason": "string (required if hidden=true)"
  }
  ```
- **Side Effects:**
  - Set `isHidden`, `hiddenAt`, `hiddenReason` on post
  - Remove from user feeds if hidden

#### 2.4 Delete Post (Admin)
- **Endpoint:** `DELETE /api/v1/admin/posts/:postId`
- **Side Effects:**
  - Soft delete: Set `deletedAt` on post
  - Cascade delete comments, reactions, shares
  - Remove from user feeds

#### 2.5 View Reported Posts
- **Endpoint:** `GET /api/v1/admin/posts/reported`
- **Query Params:** Same as 2.1, but pre-filtered to only posts with `reportsCount > 0`
- **Response:** Posts sorted by `reportsCount` (highest first)

---

### 3. **Comment Management** ⚠️ **CRITICAL**

**Why:** Comments can be reported and need moderation.

#### 3.1 List All Comments
- **Endpoint:** `GET /api/v1/admin/comments`
- **Query Params:**
  - `page`, `limit` (pagination)
  - `status` (filter by: `all`, `reported`, `deleted`)
  - `postId` (filter by post)
  - `userId` (filter by author)
  - `search` (search in content)
  - `sortBy` (`createdAt`, `reportsCount`)
- **Response:** Paginated list of comments with:
  - Comment content, author, post info
  - Reports count
  - `deletedAt` status

#### 3.2 Get Comment Details
- **Endpoint:** `GET /api/v1/admin/comments/:commentId`
- **Response:** Full comment details including:
  - All comment fields
  - Author info
  - Post info
  - All reports for this comment
  - Parent comment (if reply)

#### 3.3 Delete Comment (Admin)
- **Endpoint:** `DELETE /api/v1/admin/comments/:commentId`
- **Side Effects:**
  - Soft delete: Set `deletedAt` on comment
  - Decrement post `commentsCount`
  - Cascade delete reactions

#### 3.4 View Reported Comments
- **Endpoint:** `GET /api/v1/admin/comments/reported`
- **Query Params:** Same as 3.1, but pre-filtered to only comments with reports
- **Response:** Comments with their reports

---

### 4. **User Management** ✅ **PARTIALLY IMPLEMENTED**

**What Exists:**
- ✅ List users (with pagination, search, filters)
- ✅ Block/unblock users
- ✅ View user details

**What's Missing:**

#### 4.1 View User's Reported Content
- **Endpoint:** `GET /api/v1/admin/users/:userId/reported-content`
- **Response:** All posts and comments by this user that have been reported

#### 4.2 View User's Reports History
- **Endpoint:** `GET /api/v1/admin/users/:userId/reports`
- **Response:** All reports submitted by this user (to detect abuse of reporting system)

#### 4.3 Suspend User (Enhanced)
- **Endpoint:** `PATCH /api/v1/admin/users/:userId/suspend`
- **Body:**
  ```json
  {
    "suspended": boolean,
    "reason": "string (required if suspended=true)",
    "duration": number (optional, days)
  }
  ```
- **Note:** Your existing `toogleUserBlock` endpoint works, but adding reason and duration tracking would be better.

---

### 5. **Analytics Dashboard** ⚠️ **REQUIRED**

**Why:** Your dashboard UI exists but shows hardcoded data. You need real metrics.

#### 5.1 Dashboard Statistics
- **Endpoint:** `GET /api/v1/admin/analytics/dashboard`
- **Response:**
  ```json
  {
    "users": {
      "total": number,
      "active": number,  // Users active in last 30 days
      "blocked": number,
      "newToday": number,
      "newThisWeek": number,
      "newThisMonth": number
    },
    "posts": {
      "total": number,
      "reported": number,  // Posts with reportsCount > 0
      "hidden": number,    // Posts with isHidden=true
      "deleted": number,   // Posts with deletedAt != null
      "createdToday": number,
      "createdThisWeek": number,
      "createdThisMonth": number
    },
    "comments": {
      "total": number,
      "reported": number,
      "deleted": number,
      "createdToday": number
    },
    "reports": {
      "total": number,
      "pending": number,      // Status = PENDING
      "open": number,         // Status = OPEN
      "investigating": number, // Status = INVESTIGATING
      "resolved": number,     // Status = RESOLVED_*
      "critical": number,     // Severity = CRITICAL
      "high": number,         // Severity = HIGH
      "createdToday": number,
      "createdThisWeek": number
    },
    "engagement": {
      "totalLikes": number,
      "totalComments": number,
      "totalShares": number
    }
  }
  ```

#### 5.2 Report Statistics by Reason
- **Endpoint:** `GET /api/v1/admin/analytics/reports-by-reason`
- **Response:** Count of reports grouped by `reason` (SPAM, HARASSMENT, etc.)

#### 5.3 Report Statistics by Severity
- **Endpoint:** `GET /api/v1/admin/analytics/reports-by-severity`
- **Response:** Count of reports grouped by `severity`

---

## 🏗️ Implementation Architecture

### **Service Layer Structure**

```
post-service/
  src/
    controllers/
      admin.controller.ts          # NEW
    services/
      impliments/
        admin.service.ts            # NEW
    repositories/
      interface/
        IAdminRepository.ts         # NEW
      impliments/
        admin.repository.ts         # NEW
    routes/
      admin.routes.ts               # NEW
```

### **API Gateway Routes**

Add to `api-gateway/src/constants/routes.ts`:
```typescript
ADMIN: {
  BASE: `${API_VERSION}/admin`,
  REPORTS: `${API_VERSION}/admin/reports`,
  REPORTS_BY_ID: (id: string) => `${API_VERSION}/admin/reports/${id}`,
  REPORTS_ACTION: (id: string) => `${API_VERSION}/admin/reports/${id}/action`,
  POSTS: `${API_VERSION}/admin/posts`,
  POSTS_BY_ID: (id: string) => `${API_VERSION}/admin/posts/${id}`,
  POSTS_HIDE: (id: string) => `${API_VERSION}/admin/posts/${id}/hide`,
  COMMENTS: `${API_VERSION}/admin/comments`,
  COMMENTS_BY_ID: (id: string) => `${API_VERSION}/admin/comments/${id}`,
  ANALYTICS_DASHBOARD: `${API_VERSION}/admin/analytics/dashboard`,
  ANALYTICS_REPORTS_BY_REASON: `${API_VERSION}/admin/analytics/reports-by-reason`,
  ANALYTICS_REPORTS_BY_SEVERITY: `${API_VERSION}/admin/analytics/reports-by-severity`,
}
```

### **Authentication & Authorization**

- **Middleware:** Use existing `requireRole("superAdmin")` middleware
- **All admin endpoints must:**
  - Require JWT authentication
  - Require `superAdmin` role
  - Log all admin actions (for audit trail)

---

## 📊 Database Queries Needed

### **Reports**
- List reports with filters (status, targetType, severity, reason)
- Get reports by target (post/comment)
- Count reports by status/severity/reason
- Update report status with review info

### **Posts**
- List posts with filters (status, userId, search)
- Get posts with reports count
- Update post `isHidden`, `hiddenAt`, `hiddenReason`
- Count posts by status

### **Comments**
- List comments with filters (status, postId, userId, search)
- Get comments with reports count
- Soft delete comments
- Count comments by status

### **Analytics**
- Count users (total, active, blocked, new)
- Count posts (total, reported, hidden, deleted, new)
- Count comments (total, reported, deleted, new)
- Count reports (by status, severity, reason)
- Count engagement (likes, comments, shares)

---

## 🎨 Frontend Admin Pages Needed

### **1. Reports Management Page**
- List all reports with filters
- View report details modal
- Take action (Approve/Remove/Ignore)
- Bulk actions
- Link to reported content

### **2. Posts Management Page**
- List all posts with filters
- View post details
- Hide/unhide posts
- Delete posts
- View reported posts

### **3. Comments Management Page**
- List all comments with filters
- View comment details
- Delete comments
- View reported comments

### **4. Analytics Dashboard** (Update existing)
- Replace hardcoded data with real API calls
- Show real-time statistics
- Charts for trends (optional, but nice to have)

---

## ✅ Implementation Checklist

### **Backend (Post Service)**
- [ ] Create `admin.controller.ts` with all report management endpoints
- [ ] Create `admin.service.ts` with business logic
- [ ] Create `admin.repository.ts` with database queries
- [ ] Create `admin.routes.ts` with route definitions
- [ ] Add admin routes to post-service main router
- [ ] Add admin proxy middleware to API Gateway
- [ ] Add admin routes to API Gateway constants

### **Backend (Auth Service)**
- [ ] Add `GET /api/v1/admin/users/:userId/reported-content` endpoint
- [ ] Add `GET /api/v1/admin/users/:userId/reports` endpoint
- [ ] Enhance suspend user endpoint (add reason, duration)

### **Frontend**
- [ ] Create `/admin/reports` page
- [ ] Create `/admin/posts` page
- [ ] Create `/admin/comments` page
- [ ] Update `/admin/dashboard` page with real API calls
- [ ] Create admin API service functions
- [ ] Add admin navigation links

---

## 🚫 What NOT to Build

**Do NOT implement:**
- ❌ User role management (beyond existing superAdmin)
- ❌ Content categories/tags management (not in your schema)
- ❌ Advanced analytics (beyond basic counts)
- ❌ Email notifications to admins (out of scope)
- ❌ Automated moderation (ML/AI-based)
- ❌ Admin activity logs UI (backend logging is enough)
- ❌ Content scheduling
- ❌ Bulk user operations (beyond block/unblock)
- ❌ Advanced search/filtering (basic is enough)

---

## 📝 Summary

**Total Essential Admin Features: 15 endpoints**

1. **Reports (4 endpoints):** List, Get Details, Take Action, Bulk Actions
2. **Posts (5 endpoints):** List, Get Details, Hide/Unhide, Delete, View Reported
3. **Comments (4 endpoints):** List, Get Details, Delete, View Reported
4. **Users (2 endpoints):** View Reported Content, View Reports History
5. **Analytics (3 endpoints):** Dashboard Stats, Reports by Reason, Reports by Severity

**All features are:**
- ✅ Based on existing database schema
- ✅ Required for production-ready moderation
- ✅ Following industry standards (LinkedIn, Facebook, Twitter)
- ✅ Minimal but complete
- ✅ No unnecessary bloat

---

## 🎯 Next Steps

1. **Review this document** and confirm these are the features you need
2. **Prioritize implementation:**
   - **Phase 1 (Critical):** Report Management (1.1-1.4)
   - **Phase 2 (Critical):** Post Management (2.1-2.5)
   - **Phase 3 (Critical):** Comment Management (3.1-3.4)
   - **Phase 4 (Required):** Analytics Dashboard (5.1-5.3)
   - **Phase 5 (Nice to have):** Enhanced User Management (4.1-4.3)
3. **Start with Report Management** - it's the most critical missing piece

---

**Document Generated:** Based on comprehensive codebase analysis  
**Last Updated:** Analysis of existing features, schemas, and routes

