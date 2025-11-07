import prisma from "../../config/prisma.config";
import { Prisma, User as PrismaUser } from "@prisma/client";
import logger from "../../utils/logger.util";
import { BaseRepository } from "./base.repository";
import bcrypt from "bcrypt";
import { User } from "../../types/auth";
import { IUserRepository } from "../interfaces/IUserRepository";

export class UserRepository
  extends BaseRepository<
    typeof prisma.user,
    PrismaUser,
    Prisma.UserCreateInput,
    Prisma.UserUpdateInput,
    Prisma.UserWhereUniqueInput
  >
  implements IUserRepository
{
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
  ): Promise<any | null> {
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
        // Check if the current user is a follower of this profile
        followers: {
          where: {
            followerId: currentUserId,
            deletedAt: null,
          },
          select: {
            followerId: true,
          },
        },
      },
    });

    if (!user) return null;

    const { followers, ...rest } = user;
    return {
      ...rest,
      isFollowing: followers.length > 0,
    };
  }

  async findFollowers(userId: string, currentUserId: string): Promise<any[]> {
    console.log('🔍 DEBUG findFollowers - userId:', userId, 'currentUserId:', currentUserId);
    
    // First, let's check if there are ANY follow records for this user
    const allFollows = await prisma.follow.findMany({
      where: { followingId: userId },
    });
    console.log('🔍 DEBUG - All follows for followingId:', userId, 'count:', allFollows.length);
    console.log('🔍 DEBUG - Sample follow records:', allFollows.slice(0, 3));
    
    // Now get all follower relations with deletedAt check
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
      isFollowing: followingIdsSet.has(relation.follower.id),
    }));

    console.log('this is the followers -----------------------------######################,', followers);
    return followers;
  }

  async findFollowing(userId: string, currentUserId: string): Promise<any[]> {
    console.log('🔍 DEBUG findFollowing - userId:', userId, 'currentUserId:', currentUserId);
    
    // First, let's check if there are ANY follow records for this user
    const allFollows = await prisma.follow.findMany({
      where: { followerId: userId },
    });
    console.log('🔍 DEBUG - All follows for followerId:', userId, 'count:', allFollows.length);
    
    // Check how many are deleted vs active
    const activeFollows = allFollows.filter(f => f.deletedAt === null);
    const deletedFollows = allFollows.filter(f => f.deletedAt !== null);
    console.log('🔍 DEBUG - Active follows:', activeFollows.length);
    console.log('🔍 DEBUG - Deleted follows:', deletedFollows.length);
    console.log('🔍 DEBUG - Sample active records:', activeFollows.slice(0, 3));
    console.log('🔍 DEBUG - Sample deleted records:', deletedFollows.slice(0, 3));
    
    // First, get all following relations
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

    console.log('🔍 DEBUG - Following relations found:', followingRelations.length);
    console.log('🔍 DEBUG - First relation:', followingRelations[0]);

    // Get all following IDs
    const followingIds = followingRelations.map(rel => rel.following.id);
    console.log('🔍 DEBUG - Following IDs:', followingIds);

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

    // Map the results to the desired shape
    const following = followingRelations.map(relation => ({
      ...relation.following,
      isFollowing: followingIdsSet.has(relation.following.id),
    }));

    console.log('this is the following -----------------------------######################,', following); 
    return following;
  }
}
