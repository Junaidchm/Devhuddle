import { Status } from "@grpc/grpc-js/build/src/constants";
import {
  ListFollowersRequest,
  ListFollowersResponse,
  ListFollowingRequest,
} from "../../grpc/generated/auth";
import { IUserRepository } from "../../repositories/user.repository";
import { IuserFollowsService } from "../../services/interface/IuserFollowService";
import { CustomError } from "../../utils/error.util";
import { Messages } from "../../constents/reqresMessages";
import logger from "../../utils/logger.util";

export class UserFollowService implements IuserFollowsService {
  constructor(private UserRepository: IUserRepository) {}

  async handleListUserFollowers(
    {userName,page,pageSize}: ListFollowingRequest
  ): Promise<ListFollowersResponse> {
    try {
      if (!userName || page < 1 || pageSize < 1) {
        throw new CustomError(Status.INVALID_ARGUMENT,Messages.INVALID_REQUEST)
      }

    //   const response = await this.UserRepository.getFollowers(
    //     userName,
    //     page,
    //     pageSize
    //   );
      
      return {users:[{createdAt:"10",email:'junu',id:'12224'}],total:300}
    } catch (err: any) {
      logger.error("ListFollowers service error", { error: err.message });
       throw err instanceof CustomError
              ? err
              : new CustomError(Status.INTERNAL, Messages.REGISTRATION_FAILD);
    }
  }
}
