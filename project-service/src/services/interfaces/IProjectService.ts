import {
  CreateProjectRequest,
  CreateProjectResponse,
  UpdateProjectRequest,
  UpdateProjectResponse,
  GetProjectRequest,
  GetProjectResponse,
  ListProjectsRequest,
  ListProjectsResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  PublishProjectRequest,
  PublishProjectResponse,
  GetTrendingProjectsRequest,
  GetTrendingProjectsResponse,
  GetTopProjectsRequest,
  GetTopProjectsResponse,
  SearchProjectsRequest,
  SearchProjectsResponse,
  TrackProjectViewRequest,
  TrackProjectViewResponse,
} from "../../grpc/generated/project";

export interface IProjectService {
  createProject(req: CreateProjectRequest): Promise<CreateProjectResponse>;
  updateProject(req: UpdateProjectRequest): Promise<UpdateProjectResponse>;
  getProject(req: GetProjectRequest): Promise<GetProjectResponse>;
  listProjects(req: ListProjectsRequest): Promise<ListProjectsResponse>;
  deleteProject(req: DeleteProjectRequest): Promise<DeleteProjectResponse>;
  publishProject(req: PublishProjectRequest): Promise<PublishProjectResponse>;
  getTrendingProjects(req: GetTrendingProjectsRequest): Promise<GetTrendingProjectsResponse>;
  getTopProjects(req: GetTopProjectsRequest): Promise<GetTopProjectsResponse>;
  searchProjects(req: SearchProjectsRequest): Promise<SearchProjectsResponse>;
  trackProjectView(req: TrackProjectViewRequest): Promise<TrackProjectViewResponse>;
}

