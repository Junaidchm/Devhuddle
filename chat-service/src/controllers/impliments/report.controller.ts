import { Request, Response } from "express";
import { IReportService } from "../../services/interfaces/IReportService";
import { CreateReportDto } from "../../dtos/report.dto";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";

export class ReportController {
    constructor(private reportService: IReportService) {}

    createReport = async (req: Request, res: Response) => {
        try {
            const userDataHeader = req.headers["x-user-data"] as string;
            if (!userDataHeader) {
                return res.status(401).json({ message: "Unauthorized: Missing user data" });
            }

            const userData = JSON.parse(userDataHeader);
            const reporterId = userData.id;

            if (!reporterId) {
                return res.status(401).json({ message: "Unauthorized: Missing user ID" });
            }

            const dto = plainToInstance(CreateReportDto, req.body);
            const errors = await validate(dto);
            if (errors.length > 0) {
                console.error("Validation failed for createReport:", errors);
                return res.status(400).json({ message: "Validation failed", errors });
            }

            const report = await this.reportService.createReport(reporterId, dto);
            return res.status(201).json({
                message: "Report submitted successfully",
                data: report
            });
        } catch (error: any) {
            console.error("Error in createReport controller:", error);
            const status = error.status || 500;
            return res.status(status).json({ message: error.message || "Internal server error" });
        }
    };

    getReportsByConversation = async (req: Request, res: Response) => {
        try {
            const conversationId = req.params.conversationId as string;
            const reports = await this.reportService.getReportsByConversation(conversationId);
            return res.status(200).json({ data: reports });
        } catch (error: any) {
            console.error("Error in getReportsByConversation controller:", error);
            return res.status(500).json({ message: error.message || "Internal server error" });
        }
    };
}
