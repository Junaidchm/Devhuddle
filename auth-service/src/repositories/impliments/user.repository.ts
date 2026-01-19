import prisma from "../../config/prisma.config";
import { Prisma, User as PrismaUser } from "@prisma/client";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import bcrypt from "bcrypt";
import { User } from "../../types/auth";
import { IUserRepository } from "../interfaces/IUserRepository";
import { UserProfile, UserWithFollowStatus } from "../../types/common.types";

export class UserRepository
  extends BaseRepository<
    typeof prisma.user,
    PrismaUser,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereUniqueInput
  >
  implements IUserRepository {
  constructor() {
    super(prisma.user);
  }

  async findByEmail(email: string): Promise<User | null> {
    try {
      return await this.model.findUnique({ where: { email } });
    } catch (error) {
      logger.error("Error finding user by email", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findByIdUser(id: string): Promise<User | null> {
    try {
      return await super.findById(id);
    } catch (error) {
      logger.error("Error finding user by id", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    try {
      return await this.model.findUnique({ where: { username } });
    } catch (error) {
      logger.error("Error finding user by username", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async createUser(
    email: string,
    username: string,
    name: string,
    password: string
  ): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      return await super.create({
        email,
        username,
        name,
        password: hashedPassword,
      });
    } catch (error) {
      logger.error("Error creating user", { error: (error as Error).message });
      throw new Error("Database error");
    }
  }

  async verifyPassword(
    userPassword: string,
    password: string
  ): Promise<boolean> {
    try {
      return await bcrypt.compare(password, userPassword);
    } catch (error) {
      logger.error("Error verifying password", {
        error: (error as Error).message,
      });
      throw new Error("Password verification failed");
    }
  }

  async updateEmailVerified(
    email: string,
    emailVerified: boolean
  ): Promise<User> {
    try {
      return await super.updateWhere({ email }, { emailVerified });
    } catch (error) {
      logger.error("Error updating email verification", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async searchUsers(
    query: string,
    currentUserId: string
  ): Promise<Partial<User>[]> {
    const users = await prisma.user.findMany({
      where: {
        id: {
          not: currentUserId, // Exclude the current user from results
        },
        OR: [
          {
            name: {
              contains: query,
              mode: "insensitive", // Case-insensitive search
            },
          },
          {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        name: true,
        username: true,
        profilePicture: true,
      },
      take: 10, // Limit the number of results for performance
    });
    return users;
  }

  async updatePassword(email: string, password: string): Promise<User> {
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      return await super.updateWhere({ email }, { password: hashedPassword });
    } catch (error) {
      logger.error("Error updating password", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<User> {
    try {
      return await super.updateWhere(
        { id: userId },
        data as Prisma.UserUpdateInput
      );
    } catch (error) {
      logger.error("Error updating profile", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async createOAuthUser({
    email,
    username,
    name,
  }: {
    email: string;
    username: string;
    name: string;
  }): Promise<User> {
    try {
      return await super.create({
        email,
        username,
        name,
        emailVerified: true,
        password: "",
      });
    } catch (error) {
      logger.error("Error creating OAuth user", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async findProfileByUsername(
    username: string,
    currentUserId: string
  ): Promise<UserProfile | null> {
    // Profile pages require authentication (social media app - no public profiles)
    if (!currentUserId || typeof currentUserId !== 'string' || currentUserId.trim().length === 0) {
      throw new Error("Authentication required to view profiles");
    }

    // Always include followers check since authentication is required
    const hasCurrentUserId = true;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        emailVerified: true,
        profilePicture: true,
        location: true,
        bio: true,
        jobTitle: true,
        company: true,
        skills: true,
        yearsOfExperience: true,
        createdAt: true,
        _count: {
          select: {
            // Filter counts to only include active (non-deleted) records
            followers: {
              where: {
                deletedAt: null,
              },
            },
            following: {
              where: {
                deletedAt: null,
              },
            },
          },
        },
        // Check if the current user is a follower of this profile (only if currentUserId is provided and valid)
        ...(hasCurrentUserId ? {
          followers: {
            where: {
              followerId: currentUserId,
              deletedAt: null,
            },
            select: {
              followerId: true,
            },
          },
        } : {}),
      },
    });

    if (!user) return null;

    // If currentUserId was provided, check following status; otherwise default to false
    let isFollowing = false;

    // We know followers are included because hasCurrentUserId is true and we selected it
    const userWithFollowers = user as typeof user & { followers: { followerId: string }[] };

    if (hasCurrentUserId && userWithFollowers.followers) {
      const followers = userWithFollowers.followers;
      isFollowing = Array.isArray(followers) && followers.length > 0;
    }

    // Create a clean, serializable object
    const result = {
      ...user,
      profilePicture: user.profilePicture || undefined,
      location: user.location || undefined,
      bio: user.bio || undefined,
      jobTitle: user.jobTitle || undefined,
      company: user.company || undefined,
      yearsOfExperience: user.yearsOfExperience || null,
      skills: user.skills || [],
      isFollowing,
    };

    return result;
  }

  async findFollowers(userId: string, currentUserId: string): Promise<UserWithFollowStatus[]> {
   
    const followerRelations = await prisma.follow.findMany({
      where: { followingId: userId, deletedAt: null },
      include: {
        follower: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            profilePicture: true,
            location: true,
            bio: true,
            jobTitle: true,
            company: true,
            createdAt: true,
          }
        },
      },
    });

    console.log('🔍 DEBUG - Follower relations found:', followerRelations.length);
    console.log('🔍 DEBUG - First relation:', followerRelations[0]);

    // Get all follower IDs
    const followerIds = followerRelations.map(rel => rel.follower.id);
    console.log('🔍 DEBUG - Follower IDs:', followerIds);

    // Check which of these followers the current user is following
    const currentUserFollows = followerIds.length > 0 ? await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: followerIds },
        deletedAt: null,
      },
      select: {
        followingId: true,
      },
    }) : [];

    const followingIdsSet = new Set(currentUserFollows.map(f => f.followingId));

    // Map the results to the desired shape
    const followers = followerRelations.map(relation => ({
      ...relation.follower,
      bio: relation.follower.bio || undefined,
      jobTitle: relation.follower.jobTitle || undefined,
      company: relation.follower.company || undefined,
      location: relation.follower.location || undefined,
      profilePicture: relation.follower.profilePicture || undefined,
      isFollowing: followingIdsSet.has(relation.follower.id),
      isFollower: true, // They are following the current user
    }));

    return followers;
  }

  async findFollowing(userId: string, currentUserId: string): Promise<UserWithFollowStatus[]> {

    const followingRelations = await prisma.follow.findMany({
      where: { followerId: userId, deletedAt: null },
      include: {
        following: {
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            profilePicture: true,
            location: true,
            bio: true,
            jobTitle: true,
            company: true,
            createdAt: true,
          }
        },
      },
    });

    // Get all following IDs
    const followingIds = followingRelations.map(rel => rel.following.id);

    // Check which of these people the current user is following
    const currentUserFollows = followingIds.length > 0 ? await prisma.follow.findMany({
      where: {
        followerId: currentUserId,
        followingId: { in: followingIds },
        deletedAt: null,
      },
      select: {
        followingId: true,
      },
    }) : [];

    const followingIdsSet = new Set(currentUserFollows.map(f => f.followingId));
    
    // Check who follows the user back
    const followerIds = followingRelations.map(r => r.following.id);
    const followsBackRelations = followerIds.length > 0 ? await prisma.follow.findMany({
      where: {
        followerId: { in: followerIds },
        followingId: userId,
        deletedAt: null,
      },
      select: { followerId: true },
    }) : [];
    
    const followsBackSet = new Set(followsBackRelations.map(f => f.followerId));

    // Map the results to the desired shape
    const following = followingRelations.map(relation => ({
      ...relation.following,
      bio: relation.following.bio || undefined,
      jobTitle: relation.following.jobTitle || undefined,
      company: relation.following.company || undefined,
      location: relation.following.location || undefined,
      profilePicture: relation.following.profilePicture || undefined,
      isFollowing: followingIdsSet.has(relation.following.id),
      isFollower: followsBackSet.has(relation.following.id), // Check if they follow back
    }));

    return following;
  }


}
