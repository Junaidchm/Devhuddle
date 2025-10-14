import prisma from "../../config/prisma.config";
import { BaseRepository } from "../base.repository";
import { Prisma, Follow } from "@prisma/client";
import { IFollowsRepository } from "../interfaces/IFollowsRepository";
import { SuggestedUser } from "../../types/auth";
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
    // gettign users which user follows
    const followings = await prisma.user.findUnique({
      where: {
        id: userId,
      },
      select: {
        following: { select: { followingId: true } },
      },
    });

    if (!followings || followings.following.length === 0) {
      // Fallback: Query top popular users (exclude self)
      return (users = await this._getFallbackSuggestions(userId, limit));
    } else {
      const followingIds = followings.following.map((f) => f.followingId);

      // getting users which user's followers follows , this called second degree users
      const secondDegree = await prisma.follow.groupBy({
        by: ["followerId"],
        where: {
          followingId: { in: followingIds },
          followerId: { notIn: [userId, ...followingIds] },
          deletedAt: null,
        },
        _count: { followingId: true },
        orderBy: {
          _count: {
            followingId: "desc",
          },
        },
        take: limit * 2,
      });

      const candidateIds = secondDegree.map((g) => g.followerId);

      users = await prisma.user.findMany({
        where: { id: { in: candidateIds } },
        select: {
          id: true,
          username: true,
          name: true,
          profilePicture: true,
          _count: { select: { followers: { where: { deletedAt: null } } } },
        },
        take: limit,
        orderBy: { followers: { _count: "desc" } },
      });

      console.log("these are the users i found");

      return users;
    }
  }

  // Helper for fallback (top popular users, exclude self)
  private async _getFallbackSuggestions(
    userId: string,
    limit: number
  ): Promise<SuggestedUser[]> {
    return prisma.user.findMany({
      where: {
        id: { not: userId },
      },
      select: {
        id: true,
        username: true,
        name: true,
        profilePicture: true,
        _count: { select: { followers: { where: { deletedAt: null } } } },
      },
      take: limit,
      orderBy: { followers: { _count: "desc" } },
    });
  }

  async follow(followerId: string, followingId: string): Promise<void> {
    try {
      await prisma.follow.upsert({
        where: { followerId_followingId: { followerId, followingId } },
        create: { followerId, followingId, version: 1 },
        update: { deletedAt: null, version: { increment: 1 } },
      });
    } catch (error) {
      logger.error("Error following users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async unfollow(followerId: string, followingId: string): Promise<void> {
    try {
      await prisma.follow.updateMany({
        where: { followerId, followingId, deletedAt: null },
        data: { deletedAt: new Date(), version: { increment: 1 } },
      });
    } catch (error) {
      logger.error("Error unfollowing users", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }

  async getVersion(followerId: string, followingId: string): Promise<number> {
    try {
      const follow = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId, followingId } },
        select: {
          version: true,
        },
      });

      return follow?.version || 0;
    } catch (error) {
      logger.error("Error selecting the follow version", {
        error: (error as Error).message,
      });
      throw new Error("Database error");
    }
  }
}
