import * as grpc from "@grpc/grpc-js";
import logger from "./utils/logger.util";
import {
  ProjectServiceServer,
  ProjectServiceService,
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
  LikeProjectRequest,
  LikeProjectResponse,
  UnlikeProjectRequest,
  UnlikeProjectResponse,
  ShareProjectRequest,
  ShareProjectResponse,
  ReportProjectRequest,
  ReportProjectResponse,
  TrackProjectViewRequest,
  TrackProjectViewResponse,
  UploadProjectMediaRequest,
  UploadProjectMediaResponse,
} from "./grpc/generated/project";
import { ProjectService } from "./services/impliments/project.service";
import { ProjectLikeService } from "./services/impliments/project.like.service";
import { ProjectShareService } from "./services/impliments/project.share.service";
import { ProjectReportService } from "./services/impliments/project.report.service";
import { ProjectRepository } from "./repositories/impliments/project.repository";
import { ProjectLikeRepository } from "./repositories/impliments/project.like.repository";
import { ProjectShareRepository } from "./repositories/impliments/project.share.repository";
import { ProjectReportRepository } from "./repositories/impliments/project.report.repository";
import { OutboxRepository } from "./repositories/impliments/outbox.repository";
import { OutboxService } from "./services/impliments/outbox.service";
import { grpcHandler } from "./utils/grpc.helper";

// Initialize repositories
const projectRepository = new ProjectRepository();
const likeRepository = new ProjectLikeRepository();
const shareRepository = new ProjectShareRepository();
const reportRepository = new ProjectReportRepository();
const outboxRepository = new OutboxRepository();

// Initialize services
const outboxService = new OutboxService(outboxRepository);
const projectService = new ProjectService(
  projectRepository,
  likeRepository,
  shareRepository,
  outboxService
);
const likeService = new ProjectLikeService(
  likeRepository,
  projectRepository,
  outboxService
);
const shareService = new ProjectShareService(
  shareRepository,
  projectRepository,
  outboxService
);
const reportService = new ProjectReportService(
  reportRepository,
  projectRepository,
  outboxService
);

// gRPC service implementation
const projectServiceActions: ProjectServiceServer = {
  createProject: grpcHandler<CreateProjectRequest, CreateProjectResponse>(
    (req) => projectService.createProject(req)
  ),
  updateProject: grpcHandler<UpdateProjectRequest, UpdateProjectResponse>(
    (req) => projectService.updateProject(req)
  ),
  getProject: grpcHandler<GetProjectRequest, GetProjectResponse>(
    (req) => projectService.getProject(req)
  ),
  listProjects: grpcHandler<ListProjectsRequest, ListProjectsResponse>(
    (req) => projectService.listProjects(req)
  ),
  deleteProject: grpcHandler<DeleteProjectRequest, DeleteProjectResponse>(
    (req) => projectService.deleteProject(req)
  ),
  publishProject: grpcHandler<PublishProjectRequest, PublishProjectResponse>(
    (req) => projectService.publishProject(req)
  ),
  getTrendingProjects: grpcHandler<GetTrendingProjectsRequest, GetTrendingProjectsResponse>(
    (req) => projectService.getTrendingProjects(req)
  ),
  getTopProjects: grpcHandler<GetTopProjectsRequest, GetTopProjectsResponse>(
    (req) => projectService.getTopProjects(req)
  ),
  searchProjects: grpcHandler<SearchProjectsRequest, SearchProjectsResponse>(
    (req) => projectService.searchProjects(req)
  ),
  likeProject: grpcHandler<LikeProjectRequest, LikeProjectResponse>(
    (req) => likeService.likeProject(req)
  ),
  unlikeProject: grpcHandler<UnlikeProjectRequest, UnlikeProjectResponse>(
    (req) => likeService.unlikeProject(req)
  ),
  shareProject: grpcHandler<ShareProjectRequest, ShareProjectResponse>(
    (req) => shareService.shareProject(req)
  ),
  reportProject: grpcHandler<ReportProjectRequest, ReportProjectResponse>(
    (req) => reportService.reportProject(req)
  ),
  trackProjectView: grpcHandler<TrackProjectViewRequest, TrackProjectViewResponse>(
    (req) => projectService.trackProjectView(req)
  ),
  uploadProjectMedia: grpcHandler<UploadProjectMediaRequest, UploadProjectMediaResponse>(
    async (req) => {
      // Stub implementation - media upload should be handled via HTTP
      throw new Error("Media upload should be handled via HTTP endpoint, not gRPC");
    }
  ),
};

// Create and start gRPC server
export const grpcServer = new grpc.Server();

grpcServer.addService(ProjectServiceService, projectServiceActions);

const GRPC_PORT = process.env.GRPC_PORT || 50053;

grpcServer.bindAsync(
  `0.0.0.0:${GRPC_PORT}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      logger.error("Failed to start gRPC server", { error: error.message });
      process.exit(1);
    }
    grpcServer.start();
    logger.info(`gRPC server started on port ${port}`);
  }
);

