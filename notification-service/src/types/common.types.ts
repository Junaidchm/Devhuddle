// DLQ event data
export interface DlqEventData {
  [key: string]: unknown;
}

// User info cache
export interface UserInfo {
  id?: string;
  userId?: string;
  name: string;
  username: string;
  avatar?: string;
  profilePicture?: string | null;
}

export interface CachedUserInfo {
  data: UserInfo;
  timestamp: number;
}

// Actor Info
export interface ActorInfo {
  id: string;
  name: string;
  username: string;
  profilePicture: string | null;
}

// Notification Summary
export interface NotificationSummary {
  text: string;
  actors: ActorInfo[];
  [key: string]: unknown;
}

// Notification array type
export interface NotificationWithDetails {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  contextId?: string | null;
  summary: NotificationSummary | string | null;
  metadata: unknown;
  aggregatedCount: number;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
  actors: ActorInfo[];
  [key: string]: unknown;
}

// Compensation event
export interface CompensationEvent {
  followerId: string;
  followingId: string;
  compensationReason: string;
  originalDedupeId?: string;
  [key: string]: unknown;
}

// DLQ update data
export interface DlqUpdateData {
  status?: string;
  processedAt?: Date;
  error?: string;
  [key: string]: unknown;
}
