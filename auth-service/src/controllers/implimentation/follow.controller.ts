import { Request, Response } from "express";
import { IFollowsController } from "../interface/IFollowsController";
import { IFollowsService } from "../../services/interface/IFollowsService";
import { HttpStatus } from "../../constents/httpStatus";
import logger from "../../utils/logger.util";
import { Messages } from "../../constents/reqresMessages";

export class FollowsController implements IFollowsController {
  constructor(private followService: IFollowsService) {}

  async getSuggestions(req: Request, res: Response): Promise<any> {
    try {
      const { limit } = req.query; // Optional query param
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      const { suggestedUsers: result } =
        await this.followService.getSuggestions(
          userId as string,
          Number(limit) || 5
        );
      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async follow(req: Request, res: Response): Promise<void> {
    try {
      const { targetUserId } = req.body;
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      await this.followService.follow(userId, targetUserId);
      res
        .status(HttpStatus.OK)
        .json({ message: Messages.USER_FOLLOWED_SUCCESSFULLY });
    } catch (error: any) {
      logger.error("Error ", { error: error.message });
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
