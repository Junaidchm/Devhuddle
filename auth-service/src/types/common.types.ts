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

/**
 * Chat interaction data for scoring suggestions
 */
export interface ChatInteraction {
  userId: string;
  partnerId: string;
  lastMessageAt: Date;
  messageCount: number;
  lastMessageByPartner: Date | null;
  responseRate: number;  // 0-1 (how often partner replies)
}
/**
 * User with scoring metadata
 */
export interface ScoredUser extends UserWithFollowStatus {
  _score: number;
  _chatData?: ChatInteraction;
}
