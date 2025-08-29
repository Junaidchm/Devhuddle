import { ListFollowersResponse, ListFollowersRequest } from "../../grpc/generated/auth";

export interface IuserFollowsService {
    handleListUserFollowers(req:ListFollowersRequest):Promise<ListFollowersResponse>
}