import * as grpc from "@grpc/grpc-js";
import {
  ReportProjectRequest,
  ReportProjectResponse,
} from "../../grpc/generated/project";
import { IProjectReportService } from "../interfaces/IProjectReportService";
import { IProjectReportRepository } from "../../repositories/interface/IProjectReportRepository";
import { IProjectRepository } from "../../repositories/interface/IProjectRepository";
import { IOutboxService } from "../interfaces/IOutboxService";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { KAFKA_TOPICS } from "../../config/kafka.config";
import { OutboxAggregateType, OutboxEventType, ReportReason } from "@prisma/client";
import { adminServiceClient } from "../../clients/admin.client";
import { createCircuitBreaker } from "../../utils/circuit.breaker.util";

export class ProjectReportService implements IProjectReportService {
  private _submitReportBreaker;

  constructor(
    private _reportRepository: IProjectReportRepository,
    private _projectRepository: IProjectRepository,
    private outboxService?: IOutboxService
  ) {
    this._submitReportBreaker = createCircuitBreaker(
      adminServiceClient.submitReport.bind(adminServiceClient),
      "AdminHub.SubmitReport"
    );
  }

  async reportProject(req: ReportProjectRequest): Promise<ReportProjectResponse> {
    try {
      // 1. Local Validation: Validate project exists
      const project = await this._projectRepository.findProject(req.projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // 2. Local Validation: Validate reason
      const validReasons = Object.values(ReportReason);
      if (!validReasons.includes(req.reason as ReportReason)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          `Invalid report reason. Must be one of: ${validReasons.join(", ")}`
        );
      }

      // 2.5 Check if already reported locally to avoid unique constraint error
      const existingReport = await this._reportRepository.findReport(req.reporterId, req.projectId);
      if (existingReport) {
        logger.info("Project already reported by this user", { 
          reporterId: req.reporterId, 
          projectId: req.projectId 
        });
        return {
          reportId: existingReport.id,
          success: true,
        };
      }

      // 3. Centralized Ingestion: Forward to Admin Hub via gRPC (Circuit Breaker protected)
      logger.info("Forwarding project report to Admin Hub", { 
        reporterId: req.reporterId, 
        projectId: req.projectId 
      });

      const adminHubResponse = await this._submitReportBreaker.fire({
        reporterId: req.reporterId,
        targetId: req.projectId,
        targetType: "PROJECT",
        reason: req.reason,
        description: "", // Description could be from metadata if needed
        metadata: JSON.stringify({
          ...(req.metadata ? JSON.parse(req.metadata) : {}),
          ownerId: project.userId,
          contentSnippet: project.description?.substring(0, 100),
        }),
      });

      if (!adminHubResponse.success) {
        throw new CustomError(grpc.status.UNAVAILABLE, adminHubResponse.message);
      }

      // 4. Local Side-effects: Still save to local DB for local counters/analytics if required
      // The schema has `reportsCount` in Project model which might be updated via triggers or outbox
      const report = await this._reportRepository.createReport({
        reporterId: req.reporterId,
        projectId: req.projectId,
        reason: req.reason as ReportReason,
        metadata: req.metadata ? JSON.parse(req.metadata) : null,
      });

      // 5. Publish local event for counters/analytics fan-out
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT_REPORT,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_REPORT_CREATED,
          topic: KAFKA_TOPICS.PROJECT_REPORT_CREATED,
          key: report.id,
          payload: {
            dedupeId: `report-${report.id}-${Date.now()}`,
            reportId: report.id,
            adminHubReportId: adminHubResponse.reportId,
            projectId: req.projectId,
            reporterId: req.reporterId,
            projectAuthorId: project.userId,
            reason: req.reason,
            version: Date.now(),
            eventTimestamp: new Date().toISOString(),
          },
        });
      }

      return {
        reportId: adminHubResponse.reportId,
        success: true,
      };
    } catch (err: unknown) {
      logger.error("ReportProject error", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }
}

