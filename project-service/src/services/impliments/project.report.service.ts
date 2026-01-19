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

export class ProjectReportService implements IProjectReportService {
  constructor(
    private _reportRepository: IProjectReportRepository,
    private _projectRepository: IProjectRepository,
    private outboxService?: IOutboxService
  ) {}

  async reportProject(req: ReportProjectRequest): Promise<ReportProjectResponse> {
    try {
      // Validate project exists
      const project = await this._projectRepository.findProject(req.projectId);
      if (!project) {
        throw new CustomError(grpc.status.NOT_FOUND, "Project not found");
      }

      // Validate reason
      const validReasons = Object.values(ReportReason);
      if (!validReasons.includes(req.reason as ReportReason)) {
        throw new CustomError(
          grpc.status.INVALID_ARGUMENT,
          `Invalid report reason. Must be one of: ${validReasons.join(", ")}`
        );
      }

      // Check if already reported
      const existingReport = await this._reportRepository.findReport(
        req.reporterId,
        req.projectId
      );
      if (existingReport) {
        throw new CustomError(
          grpc.status.ALREADY_EXISTS,
          "Project already reported by this user"
        );
      }

      // Parse metadata if provided
      let metadata = null;
      if (req.metadata) {
        try {
          metadata = JSON.parse(req.metadata);
        } catch (e) {
          logger.warn("Invalid metadata JSON", { metadata: req.metadata });
        }
      }

      // Create report
      const report = await this._reportRepository.createReport({
        reporterId: req.reporterId,
        projectId: req.projectId,
        reason: req.reason as ReportReason,
        metadata,
      });

      // Publish event
      if (this.outboxService) {
        await this.outboxService.createOutboxEvent({
          aggregateType: OutboxAggregateType.PROJECT_REPORT,
          aggregateId: req.projectId,
          type: OutboxEventType.PROJECT_REPORT_CREATED,
          topic: KAFKA_TOPICS.PROJECT_REPORT_CREATED,
          key: report.id,
          payload: {
            reportId: report.id,
            projectId: req.projectId,
            reporterId: req.reporterId,
            reason: req.reason,
          },
        });
      }

      return {
        reportId: report.id,
        success: true,
      };
    } catch (err: unknown) {
      logger.error("ReportProject error", { error: (err as Error).message });
      if (err instanceof CustomError) throw err;
      throw new CustomError(grpc.status.INTERNAL, (err as Error).message);
    }
  }
}

