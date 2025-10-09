import prisma from "../../config/prisma.config";
import { BaseRepository } from "../base.repository";
import { Prisma, Follow } from "@prisma/client";
import { IFollowsRepository } from "../interfaces/IFollowsRepository";
import { SuggestedUser } from "../../types/auth";

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
      return (users = await this.getFallbackSuggestions(userId, limit));
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
  private async getFallbackSuggestions(
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
}
