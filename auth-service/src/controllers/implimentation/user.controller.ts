import { Request, Response } from "express";
import { IUserService } from "../../services/interface/IUserService";
import { CustomError, sendErrorResponse } from "../../utils/error.util";
import { HttpStatus } from "../../constents/httpStatus";
import logger from "../../utils/logger.util";
import { User } from "@prisma/client";

export class UserController {
  constructor(private _userService: IUserService) {}

  async getProfileByUsername(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.params;
      // Profile pages require authentication (social media app - no public profiles)
      const userData = req.headers["x-user-data"];
      if (!userData || typeof userData !== "string") {
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "Authentication required to view profiles",
        });
      }
      
      let currentUserId: string;
      try {
        const parsed = JSON.parse(userData);
        currentUserId = parsed?.id;
        if (!currentUserId) {
          return sendErrorResponse(res, {
            status: HttpStatus.UNAUTHORIZED,
            message: "Invalid authentication data",
          });
        }
      } catch (parseError) {
        logger.error("Failed to parse x-user-data header", { error: parseError });
        return sendErrorResponse(res, {
          status: HttpStatus.UNAUTHORIZED,
          message: "Invalid authentication data",
        });
      }
      
      const profile = await this._userService.getProfileByUsername(
        username,
        currentUserId
      );
      res.status(HttpStatus.OK).json(profile);
    } catch (err: unknown) {
      logger.error("Get profile error", { 
        error: (err as Error).message,
        stack: (err as Error).stack,
        username: req.params.username 
      });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
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
    } catch (err: unknown) {
      logger.error("Get followers error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
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
    } catch (err: unknown) {
      logger.error("Get following error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  /**
   * Get current user's following list (connections)
   * Endpoint: GET /api/v1/users/me/following
   */
  async getMyFollowing(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;
      const currentUser = await this._userService.getUserById(currentUserId);
      
      if (!currentUser) {
        throw new CustomError(HttpStatus.NOT_FOUND, "User not found");
      }

      if (!currentUser.username) {
        throw new CustomError(HttpStatus.BAD_REQUEST, "User username is missing");
      }

      const following = await this._userService.getFollowing(
        currentUser.username,
        currentUserId
      );
      res.status(HttpStatus.OK).json(following);
    } catch (err: unknown) {
      logger.error("Get my following error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  async searchUsers(req: Request, res: Response): Promise<void> {
    try {
      const query = req.query.q as string;
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;

      if (!query || query.trim().length < 2) {
        res.status(HttpStatus.OK).json([]);
        return;
      }

      const users: Partial<User>[] = await this._userService.searchUsers(
        query,
        currentUserId
      );
      res.status(HttpStatus.OK).json(users);
    } catch (err: unknown) {
      logger.error("Search users error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  /**
   * Get chat suggestions for current user
   * Returns user's connections for starting new chats (LinkedIn-style)
   * Endpoint: GET /api/v1/users/chat/suggestions
   */
  async getChatSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const currentUserId = JSON.parse(req.headers["x-user-data"] as string).id;
      const limit = parseInt(req.query.limit as string) || 20;

      const suggestions = await this._userService.getChatSuggestions(
        currentUserId,
        limit
      );

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          suggestions,
          total: suggestions.length,
        },
      });
    } catch (err: unknown) {
      logger.error("Get chat suggestions error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }

  /**
   * Internal endpoint for service-to-service calls
   * Gets user info by ID without requiring authentication
   * Only accessible from internal services (checks x-internal-service header)
   */
  async getUserByIdInternal(req: Request, res: Response): Promise<void> {
    try {
      // Check if this is an internal service call
      const internalServiceHeader = req.headers["x-internal-service"];
      if (!internalServiceHeader || internalServiceHeader !== "notification-service") {
        return sendErrorResponse(res, {
          status: HttpStatus.FORBIDDEN,
          message: "This endpoint is only accessible from internal services",
        });
      }

      const { userId } = req.params;
      if (!userId) {
        return sendErrorResponse(res, {
          status: HttpStatus.BAD_REQUEST,
          message: "User ID is required",
        });
      }

      const user = await this._userService.getUserById(userId);
      if (!user) {
        return sendErrorResponse(res, {
          status: HttpStatus.NOT_FOUND,
          message: "User not found",
        });
      }

      res.status(HttpStatus.OK).json({
        success: true,
        data: {
          id: user.id,
          name: user.name,
          username: user.username,
          profilePicture: user.profilePicture,
        },
      });
    } catch (err: unknown) {
      logger.error("Get user by ID internal error", { error: (err as Error).message });
      sendErrorResponse(
        res,
        err instanceof CustomError ? err : { status: 500, message: "Server error" }
      );
    }
  }
}

