import {
  ReportProjectRequest,
  ReportProjectResponse,
} from "../../grpc/generated/project";

export interface IProjectReportService {
  reportProject(req: ReportProjectRequest): Promise<ReportProjectResponse>;
}

