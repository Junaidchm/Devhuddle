/**
 * Response DTO for user data
 * Pure interface without validation decorators
 */
export interface UserResponseDto {
  id: string;
  name: string;
  username: string;
  email: string;
  fullName?: string;
  location?: string;
  bio?: string;
  profilePicture?: string;
  skills?: string[];
  jobTitle?: string;
  company?: string;
  yearsOfExperience?: number;
  followerCount?: number;
  followingCount?: number;
  isFollowing?: boolean;
  createdAt: Date;
  updatedAt: Date;
}
