import { SuggestedUser } from "../../types/auth";

export interface IFollowsRepository {
   getSuggestionsForUser(  userId: string,limit: number) :  Promise<SuggestedUser[]>
}