import {
  LikeProjectRequest,
  LikeProjectResponse,
  UnlikeProjectRequest,
  UnlikeProjectResponse,
} from "../../grpc/generated/project";

export interface IProjectLikeService {
  likeProject(req: LikeProjectRequest): Promise<LikeProjectResponse>;
  unlikeProject(req: UnlikeProjectRequest): Promise<UnlikeProjectResponse>;
}

