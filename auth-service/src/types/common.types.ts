import { User } from './auth';

// Compensation event types
export interface CompensationEvent {
  followerId: string;
  followingId: string;
  compensationReason: string;
  originalDedupeId?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface UserProfile extends Partial<User> {
  isFollowing?: boolean;
  _count?: {
    followers: number;
    following: number;
    posts?: number;
  };
}

export interface UserWithFollowStatus extends Partial<User> {
  isFollowing: boolean;
}

