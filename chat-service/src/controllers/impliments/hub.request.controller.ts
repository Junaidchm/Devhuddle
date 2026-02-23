import { Request, Response } from "express";
import { IHubRequestService } from "../../services/interfaces/IHubRequestService";
import logger from "../../utils/logger.util";

export class HubRequestController {
  constructor(private _hubRequestService: IHubRequestService) {}

  requestToJoin = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const hubId = req.params.hubId as string;
      const request = await this._hubRequestService.requestToJoin(hubId, userId);
      res.status(201).json(request);
    } catch (error: any) {
      logger.error("HubRequestController.requestToJoin Error", { error: error.message });
      res.status(error.status || 400).json({ error: error.message });
    }
  };

  approveRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
      const requestId = req.params.requestId as string;
      const updated = await this._hubRequestService.approveRequest(requestId, adminId);
      res.status(200).json(updated);
    } catch (error: any) {
      logger.error("HubRequestController.approveRequest Error", { error: error.message });
      res.status(error.status || 400).json({ error: error.message });
    }
  };

  rejectRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
      const requestId = req.params.requestId as string;
      const updated = await this._hubRequestService.rejectRequest(requestId, adminId);
      res.status(200).json(updated);
    } catch (error: any) {
      logger.error("HubRequestController.rejectRequest Error", { error: error.message });
      res.status(error.status || 400).json({ error: error.message });
    }
  };

  getPendingRequestsForHub = async (req: Request, res: Response): Promise<void> => {
    try {
      const adminId = JSON.parse(req.headers["x-user-data"] as string).id;
      const hubId = req.params.hubId as string;
      const requests = await this._hubRequestService.getPendingRequestsForHub(hubId, adminId);
      res.status(200).json(requests);
    } catch (error: any) {
      logger.error("HubRequestController.getPendingRequestsForHub Error", { error: error.message });
      res.status(error.status || 400).json({ error: error.message });
    }
  };

  cancelRequest = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const requestId = req.params.requestId as string;
      const updated = await this._hubRequestService.cancelRequest(requestId, userId);
      res.status(200).json(updated);
    } catch (error: any) {
      logger.error("HubRequestController.cancelRequest Error", { error: error.message });
      res.status(error.status || 400).json({ error: error.message });
    }
  };
}
