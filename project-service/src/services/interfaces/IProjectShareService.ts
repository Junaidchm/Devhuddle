import {
  ShareProjectRequest,
  ShareProjectResponse,
} from "../../grpc/generated/project";

export interface IProjectShareService {
  shareProject(req: ShareProjectRequest): Promise<ShareProjectResponse>;
}

