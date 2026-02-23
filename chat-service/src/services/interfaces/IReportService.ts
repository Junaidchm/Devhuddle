import { CreateReportDto } from "../../dtos/report.dto";
import { Report as PrismaReport } from "@prisma/client";

export interface IReportService {
  createReport(reporterId: string, dto: CreateReportDto): Promise<PrismaReport>;
  getReportsByConversation(conversationId: string): Promise<PrismaReport[]>;
  getReportById(id: string): Promise<PrismaReport | null>;
}
