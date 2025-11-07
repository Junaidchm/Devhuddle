import { Request, Response } from "express";
import { IUserService } from "../../services/interface/IUserService";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import logger from "../../utils/logger.util";

export class UserController {
  constructor(private _userService: IUserService) {}

  async getProfileByUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;
      const profile = await this._userService.getProfileByUsername(
        username,
        currentUserId
      );
      res.status(HttpStatus.OK).json(profile);
    } catch (err: any) {
      logger.error("Get profile error", { error: err.message });
      sendErrorResponse(res, err);
    }
  }

  async getFollowers(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;
      const followers = await this._userService.getFollowers(
        username,
        currentUserId
      );
      res.status(HttpStatus.OK).json(followers);
    } catch (err: any) {
      logger.error("Get followers error", { error: err.message });
      sendErrorResponse(res, err);
    }
  }

  async getFollowing(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;
      const following = await this._userService.getFollowing(
        username,
        currentUserId
      );
      res.status(HttpStatus.OK).json(following);
    } catch (err: any) {
      logger.error("Get following error", { error: err.message });
      sendErrorResponse(res, err);
    }
  }
}

