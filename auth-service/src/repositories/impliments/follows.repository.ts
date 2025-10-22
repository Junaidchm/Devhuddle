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

    console.log('this is the user id ------------------------>' , userId)
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

    console.log('this is the following list of the user ----------------------->' , followings)

    if (!followings || followings.following.length === 0) {
      // Fallback: Query top popular users (exclude self)
      users = await this._getFallbackSuggestions(userId, limit );
      console.log(
        "these are the users suggested when followers not there ===========================> ",
        users
      );
      return users;
    } else {
      const followingIds = followings.following.map((f) => f.followingId);
      
      console.log( 'this is the user following ids------------------------------->', followingIds)

      // getting users which user's followers follows , this called second degree users

      const secondDegree = await prisma.follow.groupBy({
        by: ["followingId"],
        where: {
          followerId: { in: followingIds },
          followingId: { notIn: [userId, ...followingIds] },
          deletedAt: null,
        },
        _count: { followerId: true },
        orderBy: {
          _count: {
            followerId: "desc",
          },
        },
        take: limit * 2,
      });

      console.log('this is the second degree result ----------------------=====================--------------> ' , secondDegree)
      

      if(secondDegree.length === 0) {
        return await this._getFallbackSuggestions(userId, limit,followingIds);
        console.log('hello guys how are you ------------>',await this._getFallbackSuggestions(userId, limit,followingIds))
      }

      const candidateIds = secondDegree.map((g) => g.followingId);
      console.log('second degree connections found:', secondDegree);
      console.log('candidate user IDs:', candidateIds);

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

      console.log(
        "these are the users suggested ===========================> ",
        users
      );

      return users;
    }
  }

  // Helper for fallback (top popular users, exclude self)
  private async _getFallbackSuggestions(
    userId: string,
    limit: number,
    followings: string[] = []
  ): Promise<SuggestedUser[]> {

    
    return prisma.user.findMany({
      where: {
        id: { notIn: [userId, ...followings] },
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
