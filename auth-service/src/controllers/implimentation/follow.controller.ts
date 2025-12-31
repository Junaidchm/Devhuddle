import { Request, Response } from "express";
import { IFollowsController } from "../interface/IFollowsController";
import { IFollowsService } from "../../services/interface/IFollowsService";
import { HttpStatus } from "../../constents/httpStatus";
import logger from "../../utils/logger.util";
import { Messages } from "../../constents/reqresMessages";

export class FollowsController implements IFollowsController {
  constructor(private followService: IFollowsService) {}

  async getSuggestions(req: Request, res: Response): Promise<void> {
    try {

      console.log('this is the req.headers -----------------------------######################,', req.headers)
      const { limit } = req.query; // Optional query param
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;

      console.log('this is the userId -----------------------------######################,', userId)
      const { suggestedUsers: result } =
        await this.followService.getSuggestions(
          userId as string,
          Number(limit) || 5
        );
      res.status(200).json(result);
    } catch (error: unknown) {
      res.status(500).json({ error: "Internal server error" });
    }
  }


  async follow(req: Request, res: Response): Promise<void> {
    try {
      const { targetUserId } = req.body;
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      
      // Validate input
      if (!targetUserId || typeof targetUserId !== 'string') {
        res.status(400).json({ error: "Invalid target user ID" });
        return;
      }

      // Prevent self-following
      if (userId === targetUserId) {
        res.status(400).json({ error: "Cannot follow yourself" });
        return;
      }

      const result = await this.followService.follow(userId, targetUserId);

      console.log('this is the result -----------------------------######################,', result)
      
      res.status(HttpStatus.OK).json({
        message: Messages.USER_FOLLOWED_SUCCESSFULLY,
        data: result,
      });
    } catch (error: unknown) {
      logger.error("Error in follow controller", { error: (error as Error).message });
      
      if ((error as Error).message === "Database error") {
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
  

  async unfollow(req: Request, res: Response): Promise<void> {
    try {
      const { targetUserId } = req.body;
      const userId = JSON.parse(req.headers["x-user-data"] as string).id;
      
      // Validate input
      if (!targetUserId || typeof targetUserId !== 'string') {
        res.status(400).json({ error: "Invalid target user ID" });
        return;
      }

      // Prevent self-unfollowing (though less critical)
      if (userId === targetUserId) {
        res.status(400).json({ error: "Cannot unfollow yourself" });
        return;
      }

      await this.followService.unfollow(userId, targetUserId);
      
      res.status(HttpStatus.OK).json({
        message: Messages.USER_UNFOLLOWED_SUCCESSFULLY,
      });
    } catch (error: unknown) {
      logger.error("Error in unfollow controller", { error: (error as Error).message });
      
      if ((error as Error).message === "Database error") {
        res.status(500).json({ error: "Internal server error" });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}
