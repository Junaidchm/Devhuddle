import { ListFollowersRequest, ListFollowersResponse } from "../../grpc/generated/auth";

export interface IuserFollowsController {
    getUserFollowersList(req:ListFollowersRequest) : Promise<ListFollowersResponse>
}