import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  ListFollowersRequest,
  ListFollowersResponse,
} from "../../grpc/generated/auth";
import { IuserFollowsService } from "../../services/interface/IuserFollowService";
import { CustomError } from "../../utils/error.util";
import { IuserFollowsController } from "../interface/IuserFollowsController";
import { Messages } from "../../constents/reqresMessages";
import logger from "../../utils/logger.util";

export class UserFollowController implements IuserFollowsController {
  constructor(private UserFollowService: IuserFollowsService) {}

  async getUserFollowersList(
    req: ListFollowersRequest
  ): Promise<ListFollowersResponse> {
    try {
      const { userName, page, pageSize } = req;
      if (!userName || !page || !pageSize) {
        throw new CustomError(
          Status.INVALID_ARGUMENT,
          Messages.UUSER_NAME_REQUIRED
        );
      }

      const response = await this.UserFollowService.handleListUserFollowers({
        userName,
        page,
        pageSize,
      });

      return response;
    } catch (err: any) {
      logger.error("ListFollowers controller error", { error: err.message });
      throw new CustomError(
        Status.INTERNAL,
        err.message || Messages.INTERNALSERVERERROR
      );
    }
  }
}
