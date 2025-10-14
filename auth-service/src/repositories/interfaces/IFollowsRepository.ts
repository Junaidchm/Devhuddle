import { SuggestedUser } from "../../types/auth";

export interface IFollowsRepository {
   getSuggestionsForUser(  userId: string,limit: number) :  Promise<SuggestedUser[]>;
   follow(followerId: string, followingId: string): Promise<void>;
   getVersion(followerId: string, followingId: string): Promise<number>;
   unfollow(followerId: string, followingId: string): Promise<void>;
}