import { Router } from "express";
import { ProjectController } from "../controllers/impliments/project.controller";
import { ProjectLikeController } from "../controllers/impliments/project.like.controller";
import { ProjectShareController } from "../controllers/impliments/project.share.controller";
import { ProjectReportController } from "../controllers/impliments/project.report.controller";
import { ProjectMediaController } from "../controllers/impliments/project.media.controller";
import { idempotencyMiddleware } from "../middlewares/idempotency.middleware";
import { IIdempotencyRepository } from "../repositories/interface/IIdempotencyRepository";
import { validateDto } from "../middlewares/validation.middleware";
import { CreateProjectDto, UpdateProjectDto, UploadProjectMediaDto, ShareProjectDto, ReportProjectDto } from "../dtos/project.dto";

const router = Router();

export const setupProjectRoutes = (
  projectController: ProjectController,
  likeController: ProjectLikeController,
  shareController: ProjectShareController,
  reportController: ProjectReportController,
  mediaController: ProjectMediaController,
  idempotencyRepository: IIdempotencyRepository
) => {
  // Project CRUD routes
  router.post(
    "/projects",
    idempotencyMiddleware(idempotencyRepository),
    validateDto(CreateProjectDto),
    projectController.createProject.bind(projectController)
  );

  router.get(
    "/projects",
    projectController.listProjects.bind(projectController)
  );

  router.get(
    "/projects/trending",
    projectController.getTrendingProjects.bind(projectController)
  );

  router.get(
    "/projects/top",
    projectController.getTopProjects.bind(projectController)
  );

  router.get(
    "/projects/search",
    projectController.searchProjects.bind(projectController)
  );

  router.get(
    "/projects/:projectId",
    projectController.getProject.bind(projectController)
  );

  router.put(
    "/projects/:projectId",
    idempotencyMiddleware(idempotencyRepository),
    validateDto(UpdateProjectDto),
    projectController.updateProject.bind(projectController)
  );

  router.delete(
    "/projects/:projectId",
    idempotencyMiddleware(idempotencyRepository),
    projectController.deleteProject.bind(projectController)
  );

  router.post(
    "/projects/:projectId/publish",
    idempotencyMiddleware(idempotencyRepository),
    projectController.publishProject.bind(projectController)
  );

  router.post(
    "/projects/:projectId/view",
    projectController.trackProjectView.bind(projectController)
  );

  // Engagement routes
  router.post(
    "/projects/:projectId/like",
    idempotencyMiddleware(idempotencyRepository),
    likeController.likeProject.bind(likeController)
  );

  router.delete(
    "/projects/:projectId/like",
    idempotencyMiddleware(idempotencyRepository),
    likeController.unlikeProject.bind(likeController)
  );

  router.post(
    "/projects/:projectId/share",
    idempotencyMiddleware(idempotencyRepository),
    validateDto(ShareProjectDto),
    shareController.shareProject.bind(shareController)
  );

  router.post(
    "/projects/:projectId/report",
    idempotencyMiddleware(idempotencyRepository),
    validateDto(ReportProjectDto),
    reportController.reportProject.bind(reportController)
  );

  // Media upload route
  router.post(
    "/projects/media",
    validateDto(UploadProjectMediaDto),
    mediaController.uploadProjectMediaHttp.bind(mediaController)
  );

  return router;
};

