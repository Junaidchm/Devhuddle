// import { Request, Response } from "express";
// import {
//   CreateProjectRequest,
//   CreateProjectResponse,
//   UpdateProjectRequest,
//   UpdateProjectResponse,
//   GetProjectRequest,
//   GetProjectResponse,
//   ListProjectsRequest,
//   ListProjectsResponse,
//   DeleteProjectRequest,
//   DeleteProjectResponse,
//   PublishProjectRequest,
//   PublishProjectResponse,
//   GetTrendingProjectsRequest,
//   GetTrendingProjectsResponse,
//   GetTopProjectsRequest,
//   GetTopProjectsResponse,
//   SearchProjectsRequest,
//   SearchProjectsResponse,
//   LikeProjectRequest,
//   LikeProjectResponse,
//   UnlikeProjectRequest,
//   UnlikeProjectResponse,
//   ShareProjectRequest,
//   ShareProjectResponse,
//   ReportProjectRequest,
//   ReportProjectResponse,
//   TrackProjectViewRequest,
//   TrackProjectViewResponse,
//   ProjectServiceClient,
// } from "../../grpc/generated/project";
// import { grpcs } from "../../utils/grpc.helper";
// import { projectClient } from "../../config/grpc.client";
// import { HttpStatus } from "../../utils/constents";
// import { logger } from "../../utils/logger";
// import { grpcToHttp } from "../../constants/http.status";
// import { filterError, sendErrorResponse } from "../../utils/error.util";

// // Project CRUD
// export const createProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const request: CreateProjectRequest = {
//       ...req.body,
//       userId: req.user?.id,
//     };

//     const response: CreateProjectResponse = await grpcs<
//       ProjectServiceClient,
//       CreateProjectRequest,
//       CreateProjectResponse
//     >(projectClient, "createProject", request);

//     logger.info("Project created successfully", {
//       projectId: response.id,
//     });

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error creating project", {
//       error: err.message,
//       stack: err.stack,
//       userId: req.user?.id,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const updateProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: UpdateProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//       ...req.body,
//     };

//     const response: UpdateProjectResponse = await grpcs<
//       ProjectServiceClient,
//       UpdateProjectRequest,
//       UpdateProjectResponse
//     >(projectClient, "updateProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error updating project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const getProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: GetProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: GetProjectResponse = await grpcs<
//       ProjectServiceClient,
//       GetProjectRequest,
//       GetProjectResponse
//     >(projectClient, "getProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error getting project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const listProjects = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const request: ListProjectsRequest = {
//       pageParam: req.query.cursor as string | undefined,
//       userId: req.user?.id,
//       filter: req.query.filter as string | undefined,
//       techStack: req.query.techStack
//         ? (Array.isArray(req.query.techStack)
//             ? (req.query.techStack as string[])
//             : [req.query.techStack as string])
//         : [],
//       tags: req.query.tags
//         ? (Array.isArray(req.query.tags)
//             ? (req.query.tags as string[])
//             : [req.query.tags as string])
//         : [],
//       period: req.query.period as string | undefined,
//       limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
//     };

//     const response: ListProjectsResponse = await grpcs<
//       ProjectServiceClient,
//       ListProjectsRequest,
//       ListProjectsResponse
//     >(projectClient, "listProjects", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error listing projects", {
//       error: err.message,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const deleteProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: DeleteProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: DeleteProjectResponse = await grpcs<
//       ProjectServiceClient,
//       DeleteProjectRequest,
//       DeleteProjectResponse
//     >(projectClient, "deleteProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error deleting project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const publishProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: PublishProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: PublishProjectResponse = await grpcs<
//       ProjectServiceClient,
//       PublishProjectRequest,
//       PublishProjectResponse
//     >(projectClient, "publishProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error publishing project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const getTrendingProjects = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const request: GetTrendingProjectsRequest = {
//       pageParam: req.query.cursor as string | undefined,
//       userId: req.user?.id,
//       limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
//       period: req.query.period as string | undefined,
//     };

//     const response: GetTrendingProjectsResponse = await grpcs<
//       ProjectServiceClient,
//       GetTrendingProjectsRequest,
//       GetTrendingProjectsResponse
//     >(projectClient, "getTrendingProjects", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error getting trending projects", {
//       error: err.message,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const getTopProjects = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const request: GetTopProjectsRequest = {
//       pageParam: req.query.cursor as string | undefined,
//       userId: req.user?.id,
//       limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
//       period: req.query.period as string | undefined,
//     };

//     const response: GetTopProjectsResponse = await grpcs<
//       ProjectServiceClient,
//       GetTopProjectsRequest,
//       GetTopProjectsResponse
//     >(projectClient, "getTopProjects", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error getting top projects", {
//       error: err.message,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const searchProjects = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const request: SearchProjectsRequest = {
//       query: req.query.query as string,
//       pageParam: req.query.cursor as string | undefined,
//       userId: req.user?.id,
//       techStack: req.query.techStack
//         ? (Array.isArray(req.query.techStack)
//             ? (req.query.techStack as string[])
//             : [req.query.techStack as string])
//         : [],
//       tags: req.query.tags
//         ? (Array.isArray(req.query.tags)
//             ? (req.query.tags as string[])
//             : [req.query.tags as string])
//         : [],
//       limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
//     };

//     const response: SearchProjectsResponse = await grpcs<
//       ProjectServiceClient,
//       SearchProjectsRequest,
//       SearchProjectsResponse
//     >(projectClient, "searchProjects", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error searching projects", {
//       error: err.message,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// // Engagement
// export const likeProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: LikeProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: LikeProjectResponse = await grpcs<
//       ProjectServiceClient,
//       LikeProjectRequest,
//       LikeProjectResponse
//     >(projectClient, "likeProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error liking project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const unlikeProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: UnlikeProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: UnlikeProjectResponse = await grpcs<
//       ProjectServiceClient,
//       UnlikeProjectRequest,
//       UnlikeProjectResponse
//     >(projectClient, "unlikeProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error unliking project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const shareProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: ShareProjectRequest = {
//       projectId,
//       userId: req.user?.id,
//       caption: req.body.caption,
//       shareType: req.body.shareType || "SHARE",
//     };

//     const response: ShareProjectResponse = await grpcs<
//       ProjectServiceClient,
//       ShareProjectRequest,
//       ShareProjectResponse
//     >(projectClient, "shareProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error sharing project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const reportProject = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: ReportProjectRequest = {
//       projectId,
//       reporterId: req.user?.id,
//       reason: req.body.reason,
//       metadata: req.body.metadata ? JSON.stringify(req.body.metadata) : undefined,
//     };

//     const response: ReportProjectResponse = await grpcs<
//       ProjectServiceClient,
//       ReportProjectRequest,
//       ReportProjectResponse
//     >(projectClient, "reportProject", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error reporting project", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

// export const trackProjectView = async (req: Request, res: Response): Promise<void> => {
//   try {
//     const { projectId } = req.params;
//     const request: TrackProjectViewRequest = {
//       projectId,
//       userId: req.user?.id,
//     };

//     const response: TrackProjectViewResponse = await grpcs<
//       ProjectServiceClient,
//       TrackProjectViewRequest,
//       TrackProjectViewResponse
//     >(projectClient, "trackProjectView", request);

//     res.status(HttpStatus.OK).json({
//       success: true,
//       data: response,
//     });
//   } catch (err: any) {
//     logger.error("Error tracking project view", {
//       error: err.message,
//       projectId: req.params.projectId,
//     });
//     const statusCode = grpcToHttp[err.code] || HttpStatus.INTERNAL_SERVER_ERROR;
//     sendErrorResponse(res, {
//       status: statusCode,
//       message: filterError(err) || "Server error",
//     });
//   }
// };

