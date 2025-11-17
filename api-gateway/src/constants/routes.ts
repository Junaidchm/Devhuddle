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
  
  // Feed Service Routes (gRPC - keep as is)
  FEED: {
    BASE: '/feed',
    LIST: '/feed/list',
    SUBMIT: '/feed/submit',
    DELETE: '/feed/delete',
    MEDIA: '/feed/media',
  },
  
  // General Service Routes (gRPC - keep as is)
  GENERAL: {
    BASE: '/general',
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

