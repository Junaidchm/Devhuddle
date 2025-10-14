import { SuggestedUser } from "../../types/auth";

export interface IFollowsService {
  getSuggestions(
    userId: string,
    limit: number
  ): Promise<{ suggestedUsers: SuggestedUser[]; error?: string }>;
  follow(followerId: string, followingId: string): Promise<void>;
  unfollow(followerId: string, followingId: string): Promise<void>;
}
