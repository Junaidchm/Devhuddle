import prisma from "../../config/prisma.config";
import { BaseRepository } from "./base.repository";
import { Prisma, Follow } from "@prisma/client";
import { IFollowsRepository } from "../interfaces/IFollowsRepository";
import { SuggestedUser, SuggestedUserFetching } from "../../types/auth";
import logger from "../../utils/logger.util";


export class FollowsRepository
  extends BaseRepository<
    typeof prisma.follow,
    Follow,
    Prisma.FollowCreateInput,
    Prisma.FollowUpdateInput,
    Prisma.FollowWhereUniqueInput
  >
  implements IFollowsRepository
{
  constructor() {
    super(prisma.follow);
  }

  async getSuggestionsForUser(
    userId: string,
    limit: number
  ): Promise<SuggestedUser[]> {
    let users: SuggestedUser[] = [];
    
    // Get users which actor follows
    const followings = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        following: { select: { followingId: true } },
      },
    });

    const followingIds: string[] = 
      followings?.following?.map((f) => f.followingId) ?? [];

    // If user follows nobody, fallback to top popular users
    if (!followingIds || followingIds.length === 0) {
      const fallbackUsers = await this._getFallbackSuggestions(userId, limit);
      return fallbackUsers;
    }

  // Find second-degree candidates: users followed by people the actor follows
    const grouped = await prisma.follow.groupBy({
      by: ["followingId"],
      where: {
        followerId: { in: followingIds },
        deletedAt: null,
        followingId: { notIn: [userId, ...followingIds] },
      },
      _count: {
        followingId: true,
      },
      orderBy: {
        _count: {
          followingId: "desc",
        },
      },
      take: limit * 2, // get extra to allow for filtering
    });

    const candidateIds = grouped.map((g) => g.followingId);

    let candidateUsers: SuggestedUser[] = [];
    if (candidateIds.length > 0) {
      // Load user profiles for candidates
      const rawUsers = await prisma.user.findMany({
        where: { 
          id: { in: candidateIds },
          isBlocked: false,
        },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
          _count: { 
            select: { 
              followers: { where: { deletedAt: null } } 
            } 
          },
        },
      });

      // Map raw users to SuggestedUser type
      candidateUsers = rawUsers.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        profilePicture: u.profilePicture,
        followersCount: u._count.followers,
        isFollowedByUser: false, 
      }));

      // Preserve groupBy ordering (most mutual connections first)
      const usersMap = new Map(candidateUsers.map((u) => [u.id, u]));
      users = candidateIds
        .map((id) => usersMap.get(id))
        .filter(Boolean) as SuggestedUser[];
    }

    // If not enough candidates, fill with fallback popular users
    if (users.length < limit) {
      const exclusions = [
        userId, 
        ...followingIds,
        ...users.map((u) => u.id)
      ];
      
      const fallbackUsers = await this._getFallbackSuggestions(
        userId,
        limit - users.length,
        exclusions
      );

      users = users.concat(fallbackUsers);
    }

    return users.slice(0, limit);
  }

  private async _getFallbackSuggestions(
    userId: string,
    limit: number,
    exclusions: string[] = []
  ): Promise<SuggestedUser[]> {
    const rawUsers = await prisma.user.findMany({
      where: {
        id: { notIn: exclusions },
        isBlocked: false,
      },
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
        _count: { 
          select: { 
            followers: { where: { deletedAt: null } } 
          } 
        },
      },
      orderBy: {
        followers: { _count: "desc" },
      },
      take: limit,
    });

    return rawUsers.map(u => ({
      id: u.id,
      username: u.username,
      name: u.name,
      profilePicture: u.profilePicture,
      followersCount: u._count.followers,
      isFollowedByUser: false,
    }));
  }

  async follow(
    followerId: string,
    followingId: string
  ): Promise<{ followingCount: number }> {
    try {
      const [follow, followingCount] = await prisma.$transaction([
        prisma.follow.upsert({
          where: { 
            followerId_followingId: { followerId, followingId } 
          },
          create: { 
            followerId, 
            followingId, 
            version: 1 
          },
          update: { 
            deletedAt: null, 
            version: { increment: 1 } 
          },
        }),
        prisma.follow.count({
          where: {
            followingId,
            deletedAt: null,
          },
        }),
      ]);

      return { followingCount };
    } catch (error) {
      logger.error("Error following user", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    try {
      await prisma.follow.updateMany({
        where: { 
          followerId, 
          followingId, 
          deletedAt: null 
        },
        data: { 
          deletedAt: new Date(), 
          version: { increment: 1 } 
        },
      });
    } catch (error) {
      logger.error("Error unfollowing user", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getVersion(followerId: string, followingId: string): Promise<number> {
    try {
      const follow = await prisma.follow.findUnique({
        where: {
          followerId_followingId: { followerId, followingId },
        },
        select: { version: true },
      });
      return follow?.version ?? 0;
    } catch (error) {
      logger.error("Error getting follow version", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async checkFollowExists(
    followerId: string, 
    followingId: string
  ): Promise<boolean> {
    try {
      const follow = await prisma.follow.findFirst({
        where: {
          followerId,
          followingId,
          deletedAt: null,
        },
      });
      return !!follow;
    } catch (error) {
      logger.error("Error checking follow exists", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getFollowerIds(userId: string): Promise<string[]> {
    try {
      const followers = await prisma.follow.findMany({
        where: {
          followingId: userId,
          deletedAt: null,
        },
        select: {
          followerId: true,
        },
      });
      return followers.map(f => f.followerId);
    } catch (error) {
      logger.error("Error getting follower IDs", {
        error: (error as Error).message,
        userId,
      });
      throw new Error("Database error");
    }
  }
}
