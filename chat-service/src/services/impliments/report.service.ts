import { IReportService } from "../interfaces/IReportService";
import { IChatRepository } from "../../repositories/interfaces/IChatRepository";
import { CreateReportDto } from "../../dtos/report.dto";
import { Report as PrismaReport } from "@prisma/client";
import { AppError } from "../../utils/AppError";
import { adminServiceClient } from "../../clients/admin.client";
import logger from "../../utils/logger.util";

export class ReportService implements IReportService {
    constructor(private chatRepository: IChatRepository) {}

    async createReport(reporterId: string, dto: CreateReportDto): Promise<PrismaReport> {
        // 1. Local Validation: Verify conversation existence
        const conversation = await this.chatRepository.findConversationById(dto.conversationId);
        if (!conversation) {
            throw new AppError("Conversation not found", 404);
        }

        // 2. Local Validation: Verify reporter participation
        const isParticipant = conversation.participants.some(p => p.userId === reporterId);
        if (!isParticipant) {
            throw new AppError("Unauthorized: You are not a participant in this conversation", 403);
        }

        // 3. Centralized Ingestion: Forward to Admin Hub via gRPC
        logger.info("Forwarding report to Admin Hub", { reporterId, targetId: dto.targetId });
        
        const grpcResponse = await adminServiceClient.submitReport({
            reporterId,
            targetId: dto.targetId,
            targetType: dto.targetType,
            reason: dto.reason,
            description: dto.description,
            metadata: JSON.stringify(dto.metadata || {}),
        });

        if (!grpcResponse.success) {
            throw new AppError(grpcResponse.message || "Failed to submit report to moderation service", 503);
        }

        // 4. (Optional) Local Audit: We could still save locally, but Phase 1 goal is consolidation
        // For now, we return the created report from the centralized service (mapped to Prisma type)
        // Note: This might require adjusting the interface if it strictly expects PrismaReport from local DB
        return {
            id: grpcResponse.reportId,
            reporterId,
            conversationId: dto.conversationId,
            targetId: dto.targetId,
            targetType: dto.targetType,
            reason: dto.reason,
            description: dto.description || null,
            metadata: dto.metadata || {},
            createdAt: new Date(),
            updatedAt: new Date(),
        } as PrismaReport;
    }

    async getReportsByConversation(conversationId: string): Promise<PrismaReport[]> {
        // In Phase 1, we still allow reading historical local reports if any, 
        // but ideally this should also be redirected to Admin Hub in Phase 2
        return this.chatRepository.getReportsByConversationId(conversationId);
    }

    async getReportById(id: string): Promise<PrismaReport | null> {
        return this.chatRepository.findReportById(id);
    }
}
