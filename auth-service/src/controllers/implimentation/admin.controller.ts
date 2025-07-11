import { Request, response, Response } from "express";
import { AdminService } from "../../services/impliments/admin.service";
import logger from "../../utils/logger.util";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import { User } from "@prisma/client";
import { Messages } from "../../constents/reqresMessages";
import { IAdminService } from "../../services/interface/IadminService";
import { IAdminController } from "../interface/IadminController";

export class AdminController implements IAdminController {
  constructor(private adminService: IAdminService) {}

  async getUsers(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const date = req.query.date as string;

      const { users, total } = await this.adminService.getUsers(
        page,
        limit,
        status,
        search,
        date
      );
      res.json({
        success: true,
        data: {
          users,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (err: any) {
      logger.error("Get users error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async getUserFullDetails(req: Request, res: Response) {
    try {
      const userId = req.params.id as string;
      const user = await this.adminService.getUserFullDetails(userId);
      res.status(HttpStatus.OK).json({
        success: true,
        data: user,
      });
    } catch (err: any) {
      logger.error("Get usersFullDetails error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }

  async toogleUserState(req: Request, res: Response) {
    try {
      const id = req.params.id as string;
      if (!id) {
        throw new CustomError(HttpStatus.BAD_REQUEST, Messages.INCOMPLETE_FORM);
      }
      logger.info(`Toogling user ${id}`);
      await this.adminService.toogleUserState(id);
      res.status(HttpStatus.OK).json({ success: true});
    } catch (err: any) {
      logger.error("Toogling user error", { error: err.message });
      sendErrorResponse(
        res,
        err instanceof CustomError
          ? err
          : { status: 500, message: "Server error" }
      );
    }
  }
}
