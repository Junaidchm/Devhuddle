export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  name: string;
  fullName?: string;
  profilePhoto?: string;
  bio?: string;
  skills?: string[];
  createdAt?: Date;
  followersCount?: number;
  followingCount?: number;
}

export interface UserWithFollowStatus extends UserProfile {
  isFollowing: boolean;
  isFollower: boolean;
}

export interface CompensationEvent {
  followerId: string;
  followingId: string;
  compensationReason: string;
  originalDedupeId?: string;
  userId?: string;
  action?: string;
  data?: any;
}
