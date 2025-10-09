import { SuggestedUser } from "../../types/auth";

export interface IFollowsService {
    getSuggestions(userId: string, limit: number): Promise<{ suggestedUsers: SuggestedUser[]; error?: string }> 
}