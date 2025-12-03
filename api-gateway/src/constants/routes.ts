/**
 * Centralized route configuration for API Gateway
 * All routes follow the pattern: /api/v1/{service}/{resource}/{action}
 * 
 * This file serves as the single source of truth for all API routes
 * to ensure consistency and maintainability across the codebase.
 */

export const API_VERSION = '/api/v1';

export const ROUTES = {
  // Engagement Service Routes
  ENGAGEMENT: {
    BASE: `${API_VERSION}/engagement`,
    LIKE_POST: (postId: string) => `${API_VERSION}/engagement/posts/${postId}/likes`,
    UNLIKE_POST: (postId: string) => `${API_VERSION}/engagement/posts/${postId}/likes`,
    LIKE_COMMENT: (commentId: string) => `${API_VERSION}/engagement/comments/${commentId}/likes`,
    UNLIKE_COMMENT: (commentId: string) => `${API_VERSION}/engagement/comments/${commentId}/likes`,
  },
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
  
  // Admin Routes
  ADMIN: {
    BASE: `${API_VERSION}/admin`,
    // User Management (handled by Auth Service)
    USERS: `${API_VERSION}/auth/admin/users`,
    USER_BY_ID: (id: string) => `${API_VERSION}/auth/admin/user/${id}`,
    TOGGLE_USER: (id: string) => `${API_VERSION}/auth/admin/users/${id}/toogle`,
    USER_REPORTED_CONTENT: (userId: string) => `${API_VERSION}/auth/admin/users/${userId}/reported-content`,
    USER_REPORTS: (userId: string) => `${API_VERSION}/auth/admin/users/${userId}/reports`,
    // Reports Management (handled by Post Service)
    REPORTS: `${API_VERSION}/admin/reports`,
    REPORT_BY_ID: (id: string) => `${API_VERSION}/admin/reports/${id}`,
    REPORT_ACTION: (id: string) => `${API_VERSION}/admin/reports/${id}/action`,
    REPORTS_BULK_ACTION: `${API_VERSION}/admin/reports/bulk-action`,
    // Posts Management (handled by Post Service)
    POSTS: `${API_VERSION}/admin/posts`,
    POSTS_REPORTED: `${API_VERSION}/admin/posts/reported`,
    POST_BY_ID: (id: string) => `${API_VERSION}/admin/posts/${id}`,
    POST_HIDE: (id: string) => `${API_VERSION}/admin/posts/${id}/hide`,
    POST_DELETE: (id: string) => `${API_VERSION}/admin/posts/${id}`,
    // Comments Management (handled by Post Service)
    COMMENTS: `${API_VERSION}/admin/comments`,
    COMMENTS_REPORTED: `${API_VERSION}/admin/comments/reported`,
    COMMENT_BY_ID: (id: string) => `${API_VERSION}/admin/comments/${id}`,
    COMMENT_DELETE: (id: string) => `${API_VERSION}/admin/comments/${id}`,
    // Analytics (handled by Post Service)
    ANALYTICS_DASHBOARD: `${API_VERSION}/admin/analytics/dashboard`,
    ANALYTICS_REPORTS_BY_REASON: `${API_VERSION}/admin/analytics/reports-by-reason`,
    ANALYTICS_REPORTS_BY_SEVERITY: `${API_VERSION}/admin/analytics/reports-by-severity`,
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
  
  // Feed Service Routes (HTTP Proxy to Post Service)
  FEED: {
    BASE: '/feed',
    LIST: '/feed/list',
    SUBMIT: '/feed/submit',
    DELETE: '/feed/delete',
    MEDIA: '/feed/media',
  },
  
  // Project Service Routes (HTTP Proxy)
  PROJECTS: {
    BASE: `${API_VERSION}/projects`,
    LIST: `${API_VERSION}/projects`,
    CREATE: `${API_VERSION}/projects`,
    GET: (projectId: string) => `${API_VERSION}/projects/${projectId}`,
    UPDATE: (projectId: string) => `${API_VERSION}/projects/${projectId}`,
    DELETE: (projectId: string) => `${API_VERSION}/projects/${projectId}`,
    PUBLISH: (projectId: string) => `${API_VERSION}/projects/${projectId}/publish`,
    TRENDING: `${API_VERSION}/projects/trending`,
    TOP: `${API_VERSION}/projects/top`,
    SEARCH: `${API_VERSION}/projects/search`,
    MEDIA_UPLOAD: `${API_VERSION}/projects/media`,
    LIKE: (projectId: string) => `${API_VERSION}/projects/${projectId}/like`,
    UNLIKE: (projectId: string) => `${API_VERSION}/projects/${projectId}/like`,
    SHARE: (projectId: string) => `${API_VERSION}/projects/${projectId}/share`,
    REPORT: (projectId: string) => `${API_VERSION}/projects/${projectId}/report`,
    TRACK_VIEW: (projectId: string) => `${API_VERSION}/projects/${projectId}/view`,
  },
  
  // Health Check
  HEALTH: '/health',
} as const;

// Type helper for route values
// Extracts all string values from nested route objects
// type ExtractRouteValues<T> = T extends string
//   ? T
//   : T extends (...args: any[]) => string
//   ? T
//   : T extends object
//   ? {
//       [K in keyof T]: ExtractRouteValues<T[K]>;
//     }[keyof T]
//   : never;

// export type RouteValue = ExtractRouteValues<typeof ROUTES[keyof typeof ROUTES]>;

