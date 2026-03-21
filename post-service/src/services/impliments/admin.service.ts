import { IAdminService, TakeReportActionParams, BulkReportActionParams, HidePostParams, HideCommentParams } from "../interfaces/IAdminService";
import { IAdminRepository, ListReportsParams, ListReportsResult, ListPostsParams, ListPostsResult, ListCommentsParams, ListCommentsResult, DashboardStats } from "../../repositories/interface/IAdminRepository";
import { ReportStatus, ReportTargetType } from "@prisma/client";
import { IPostRepository } from "../../repositories/interface/IPostRepository";
import { ICommentRepository } from "../../repositories/interface/ICommentRepository";
import { CustomError } from "../../utils/error.util";
import logger from "../../utils/logger.util";
import { userClient } from "../../config/grpc.client";
import { grpcs } from "../../utils/grpc.client.call.util";
import { UserServiceClient } from "../../grpc/generated/user";
import { createCircuitBreaker } from "../../utils/circuit.breaker.util";
import { fetchPostMedia } from "../../config/media.client";
import { adminAuthClient } from "../../config/grpc.client";

export class AdminService implements IAdminService {
  constructor(
    private _adminRepository: IAdminRepository,
    private _postRepository: IPostRepository,
    private _commentRepository: ICommentRepository,
    private _userClient: UserServiceClient = userClient
  ) {}

  private _mediaBreaker = createCircuitBreaker(fetchPostMedia, "MediaService:fetchPostMedia");

  // ==================== REPORTS ====================

  async listReports(params: ListReportsParams): Promise<ListReportsResult> {
    try {
      const result = await this._adminRepository.listReports(params);
      
      // Enrich with reporter data
      if (result.reports.length > 0) {
        result.reports = await this._enrichReportsWithUserData(result.reports);
      }
      
      return result;
    } catch (error: any) {
      logger.error("Error in listReports service", { error: error.message });
      throw new CustomError(500, "Failed to list reports");
    }
  }

  async getReportById(reportId: string) {
    try {
      const report = await this._adminRepository.getReportById(reportId);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }
      return report;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getReportById service", { error: error.message });
      throw new CustomError(500, "Failed to get report");
    }
  }

  async takeReportAction(params: TakeReportActionParams) {
    try {
      const { reportId, action, resolution, hideContent, suspendUser, reviewedById } = params;

      // Get the report first
      const report = await this._adminRepository.getReportById(reportId);
      if (!report) {
        throw new CustomError(404, "Report not found");
      }

      // Determine the new status based on action
      let newStatus: ReportStatus;
      if (action === "APPROVE") {
        newStatus = ReportStatus.RESOLVED_APPROVED;
      } else if (action === "REMOVE") {
        newStatus = ReportStatus.RESOLVED_REMOVED;
      } else {
        newStatus = ReportStatus.RESOLVED_IGNORED;
      }

      // Update report status
      const updatedReport = await this._adminRepository.updateReportStatus(
        reportId,
        newStatus,
        reviewedById,
        resolution
      );

      let updatedPost;
      let updatedComment;

      // Handle content hiding/deletion
      if (hideContent && action === "REMOVE") {
        if (report.targetType === ReportTargetType.POST && report.postId) {
          // Hide the post
          updatedPost = await this.hidePost({
            postId: report.postId,
            hidden: true,
            reason: resolution || "Removed due to report",
            adminId: reviewedById
          });
        } else if (report.targetType === ReportTargetType.COMMENT && report.commentId) {
          // Hide the comment
          updatedComment = await this.hideComment({
            commentId: report.commentId,
            hidden: true,
            reason: resolution || "Hidden due to report",
            adminId: reviewedById
          });
          
          // Decrement post comments count
          if (report.postId) {
            await this._postRepository.decrementCommentsCount(report.postId);
          }
        }
      }

      // Note: suspendUser would require calling auth-service
      // This should be done via HTTP call or gRPC to auth-service
      // For now, we'll log it
      if (suspendUser) {
        logger.info("User suspension requested", {
          userId: report.targetType === ReportTargetType.POST 
            ? report.posts?.userId 
            : report.Comment?.userId,
          reportId,
        });
        // TODO: Call auth-service to suspend user
      }

      return {
        report: updatedReport,
        post: updatedPost,
        comment: updatedComment,
      };
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in takeReportAction service", { error: error.message });
      throw new CustomError(500, "Failed to take action on report");
    }
  }

  async bulkReportAction(params: BulkReportActionParams): Promise<number> {
    try {
      const { reportIds, action, resolution, reviewedById } = params;

      // Determine the new status
      let newStatus: ReportStatus;
      if (action === "APPROVE") {
        newStatus = ReportStatus.RESOLVED_APPROVED;
      } else if (action === "REMOVE") {
        newStatus = ReportStatus.RESOLVED_REMOVED;
      } else {
        newStatus = ReportStatus.RESOLVED_IGNORED;
      }

      const updatedCount = await this._adminRepository.bulkUpdateReportStatus(
        reportIds,
        newStatus,
        reviewedById,
        resolution
      );

      return updatedCount;
    } catch (error: any) {
      logger.error("Error in bulkReportAction service", { error: error.message });
      throw new CustomError(500, "Failed to perform bulk action");
    }
  }

  // ==================== POSTS ====================

  async listPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      const result = await this._adminRepository.listPosts(params);
      
      // Enrich with user data
      if (result.posts.length > 0) {
        result.posts = await this._enrichPostsWithUserData(result.posts);
      }
      
      return result;
    } catch (error: any) {
      logger.error("Error in listPosts service", { error: error.message });
      throw new CustomError(500, "Failed to list posts");
    }
  }

  private async _enrichCommentsWithUserData(comments: any[]): Promise<any[]> {
    try {
      return await Promise.all(
        comments.map(async (comment) => {
          try {
            const userResponse: any = await grpcs<UserServiceClient, { userId: string }, any>(
              this._userClient,
              "getUserForFeedListing",
              { userId: comment.userId }
            );

            return {
              ...comment,
              author: userResponse ? {
                id: comment.userId,
                name: userResponse.name,
                username: userResponse.username,
                profilePicture: userResponse.avatar,
              } : {
                id: comment.userId,
                name: "Deleted User",
                username: "deleted_user",
                profilePicture: null,
                isDeleted: true
              }
            };
          } catch (err) {
            logger.warn(`Failed to fetch user data for comment ${comment.id}`, { userId: comment.userId });
            return {
              ...comment,
              author: {
                id: comment.userId,
                name: "Unknown",
                username: "unknown",
                profilePicture: null
              }
            };
          }
        })
      );
    } catch (error: any) {
      logger.error("Error in _enrichCommentsWithUserData", { error: error.message });
      return comments;
    }
  }

  private async _enrichReportsWithUserData(reports: any[]): Promise<any[]> {
    try {
      return await Promise.all(
        reports.map(async (report) => {
          try {
            const userResponse: any = await grpcs<UserServiceClient, { userId: string }, any>(
              this._userClient,
              "getUserForFeedListing",
              { userId: report.reporterId }
            );

            return {
              ...report,
              reporter: userResponse ? {
                id: report.reporterId,
                name: userResponse.name,
                username: userResponse.username,
                profilePicture: userResponse.avatar,
              } : {
                id: report.reporterId,
                name: "Deleted User",
                username: "deleted_user",
                profilePicture: null,
                isDeleted: true
              }
            };
          } catch (err) {
            logger.warn(`Failed to fetch user data for reporter ${report.reporterId}`, { reportId: report.id });
            return {
              ...report,
              reporter: {
                id: report.reporterId,
                name: "Unknown",
                username: "unknown",
                profilePicture: null
              }
            };
          }
        })
      );
    } catch (error) {
      logger.error("Error enriching reports with user data", { error });
      return reports;
    }
  }

  private async _enrichPostsWithUserData(posts: any[]): Promise<any[]> {
    try {
      return await Promise.all(
        posts.map(async (post) => {
          try {
            const userResponse: any = await grpcs<UserServiceClient, { userId: string }, any>(
              this._userClient,
              "getUserForFeedListing",
              { userId: post.userId }
            );

            return {
              ...post,
              author: userResponse ? {
                id: post.userId,
                name: userResponse.name,
                username: userResponse.username,
                profilePicture: userResponse.avatar,
              } : {
                id: post.userId,
                name: "Deleted User",
                username: "deleted_user",
                profilePicture: null,
                isDeleted: true
              }
            };
          } catch (err) {
            logger.warn(`Failed to fetch user data for post ${post.id}`, { userId: post.userId });
            return {
              ...post,
              author: {
                id: post.userId,
                name: "Unknown",
                username: "unknown",
                profilePicture: null
              }
            };
          }
        })
      );
    } catch (error) {
      logger.error("Error enriching posts with user data", { error });
      return posts;
    }
  }

  async getPostById(postId: string) {
    try {
      const post = await this._adminRepository.getPostById(postId);
      if (!post) {
        throw new CustomError(404, "Post not found");
      }

      // Enrich with user data
      const enriched = await this._enrichPostsWithUserData([post]);
      const enrichedPost = enriched[0];

      // Fetch media from Media Service (Resiliently)
      let mediaItems: any[] = [];
      try {
        mediaItems = await this._mediaBreaker.fire(postId);
      } catch (mediaError) {
        logger.warn("Failed to fetch media from Media Service for admin, falling back to empty list", {
          postId,
          error: (mediaError as Error).message
        });
      }

      // Map attachments
      const attachments = (mediaItems || []).map((media: any) => ({
          id: media.id,
          postId: media.postId || post.id,
          type: String(media.mediaType || "POST_IMAGE").replace("POST_", ""),
          url: media.cdnUrl || media.originalUrl,
          createdAt: media.createdAt ? new Date(media.createdAt).toISOString() : new Date().toISOString(),
      }));

      return {
        ...enrichedPost,
        attachments,
        createdAt: post.createdAt.toISOString(),
        updatedAt: post.updatedAt.toISOString(),
      };
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getPostById service", { error: error.message });
      throw new CustomError(500, "Failed to get post");
    }
  }

  async hidePost(params: HidePostParams) {
    try {
      const { postId, hidden, reason, adminId } = params;

      let result;
      if (hidden) {
        if (!reason) {
          throw new CustomError(400, "Reason is required when hiding a post");
        }
        result = await this._adminRepository.hidePost(postId, reason);
      } else {
        result = await this._adminRepository.unhidePost(postId);
      }

      // Emit Kafka event for notification
      if (result) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: postId,
          targetType: "POST",
          ownerId: result.userId,
          action: hidden ? "HIDE" : "UNHIDE",
          reason: reason || (hidden ? "Moderation action" : "Content restored"),
          adminId: adminId || "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: adminId || "system",
            action: hidden ? "POST_HIDDEN" : "POST_UNHIDDEN",
            targetType: "POST",
            targetId: postId,
            reason: reason || (hidden ? "Moderation action" : "Content restored"),
            metadata: JSON.stringify({ userId: result.userId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for post hide/unhide", { error: auditError });
        }
      }

      return result;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in hidePost service", { error: error.message });
      throw new CustomError(500, "Failed to hide/unhide post");
    }
  }

  async deletePostAdmin(postId: string) {
    try {
      const post = await this._adminRepository.getPostById(postId);
      if (!post) {
        throw new CustomError(404, "Post not found");
      }

      const deletedPost = await this._adminRepository.deletePostAdmin(postId);

      // Emit Kafka event for notification
      if (deletedPost) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: postId,
          targetType: "POST",
          ownerId: deletedPost.userId,
          action: "DELETE",
          reason: "Permanent deletion",
          adminId: "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: "system", // Admin ID not available here, should ideally be passed
            action: "POST_DELETED",
            targetType: "POST",
            targetId: postId,
            reason: "Permanent deletion",
            metadata: JSON.stringify({ userId: deletedPost.userId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for post delete", { error: auditError });
        }
      }

      return deletedPost;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in deletePostAdmin service", { error: error.message });
      throw new CustomError(500, "Failed to delete post");
    }
  }

  async listReportedPosts(params: ListPostsParams): Promise<ListPostsResult> {
    try {
      const result = await this._adminRepository.listReportedPosts(params);
      
      // Enrich with user data
      if (result.posts.length > 0) {
        result.posts = await this._enrichPostsWithUserData(result.posts);
      }
      
      return result;
    } catch (error: any) {
      logger.error("Error in listReportedPosts service", { error: error.message });
      throw new CustomError(500, "Failed to list reported posts");
    }
  }

  // ==================== COMMENTS ====================

  async listComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      const result = await this._adminRepository.listComments(params);
      
      // Enrich with user data
      if (result.comments.length > 0) {
        result.comments = await this._enrichCommentsWithUserData(result.comments);
      }
      
      return result;
    } catch (error: any) {
      logger.error("Error in listComments service", { error: error.message });
      throw new CustomError(500, "Failed to list comments");
    }
  }

  async getCommentById(commentId: string) {
    try {
      const comment = await this._adminRepository.getCommentById(commentId);
      if (!comment) {
        throw new CustomError(404, "Comment not found");
      }
      return comment;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in getCommentById service", { error: error.message });
      throw new CustomError(500, "Failed to get comment");
    }
  }

  async deleteCommentAdmin(commentId: string) {
    try {
      const comment = await this._adminRepository.getCommentById(commentId);
      if (!comment) {
        throw new CustomError(404, "Comment not found");
      }

      const deletedComment = await this._adminRepository.deleteCommentAdmin(commentId);
      
      // Decrement post comments count
      await this._postRepository.decrementCommentsCount(comment.postId);

      // Emit Kafka event for notification
      if (deletedComment) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: commentId,
          targetType: "COMMENT",
          ownerId: deletedComment.userId,
          action: "DELETE",
          reason: "Permanent deletion",
          adminId: "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: "system",
            action: "COMMENT_DELETED",
            targetType: "COMMENT",
            targetId: commentId,
            reason: "Permanent deletion",
            metadata: JSON.stringify({ userId: deletedComment.userId, postId: deletedComment.postId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for comment delete", { error: auditError });
        }
      }

      return deletedComment;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in deleteCommentAdmin service", { error: error.message });
      throw new CustomError(500, "Failed to delete comment");
    }
  }

  async hideComment(params: HideCommentParams) {
    try {
      const { commentId, hidden, reason, adminId } = params;

      let result;
      if (hidden) {
        if (!reason) {
          throw new CustomError(400, "Reason is required when hiding a comment");
        }
        result = await this._adminRepository.hideComment(commentId, reason);
      } else {
        result = await this._adminRepository.unhideComment(commentId);
      }

      // Emit Kafka event for notification
      if (result) {
        const { publishEvent } = await import("../../utils/kafka.util");
        const { KAFKA_TOPICS } = await import("../../config/kafka.config");
        
        await publishEvent(KAFKA_TOPICS.ADMIN_ACTION_ENFORCED, {
          targetId: commentId,
          targetType: "COMMENT",
          ownerId: result.userId,
          action: hidden ? "HIDE" : "UNHIDE",
          reason: reason || (hidden ? "Moderation action" : "Content restored"),
          adminId: adminId || "system",
          timestamp: new Date().toISOString(),
          version: Date.now(),
        });

        // Audit the action in auth-service
        try {
          await grpcs(adminAuthClient, "createAuditLog", {
            adminId: adminId || "system",
            action: hidden ? "COMMENT_HIDDEN" : "COMMENT_UNHIDDEN",
            targetType: "COMMENT",
            targetId: commentId,
            reason: reason || (hidden ? "Moderation action" : "Content restored"),
            metadata: JSON.stringify({ userId: result.userId, postId: result.postId }),
          });
        } catch (auditError) {
          logger.error("Failed to create audit log for comment hide/unhide", { error: auditError });
        }
      }

      return result;
    } catch (error: any) {
      if (error instanceof CustomError) throw error;
      logger.error("Error in hideComment service", { error: error.message });
      throw new CustomError(500, "Failed to hide/unhide comment");
    }
  }

  async listReportedComments(params: ListCommentsParams): Promise<ListCommentsResult> {
    try {
      const result = await this._adminRepository.listReportedComments(params);
      
      // Enrich with user data
      if (result.comments.length > 0) {
        result.comments = await this._enrichCommentsWithUserData(result.comments);
      }
      
      return result;
    } catch (error: any) {
      logger.error("Error in listReportedComments service", { error: error.message });
      throw new CustomError(500, "Failed to list reported comments");
    }
  }

  // ==================== ANALYTICS ====================

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return await this._adminRepository.getDashboardStats();
    } catch (error: any) {
      logger.error("Error in getDashboardStats service", { error: error.message });
      throw new CustomError(500, "Failed to get dashboard stats");
    }
  }

  async getReportsByReason(): Promise<Record<string, number>> {
    try {
      return await this._adminRepository.getReportsByReason();
    } catch (error: any) {
      logger.error("Error in getReportsByReason service", { error: error.message });
      throw new CustomError(500, "Failed to get reports by reason");
    }
  }

  async getReportsBySeverity(): Promise<Record<string, number>> {
    try {
      return await this._adminRepository.getReportsBySeverity();
    } catch (error: any) {
      logger.error("Error in getReportsBySeverity service", { error: error.message });
      throw new CustomError(500, "Failed to get reports by severity");
    }
  }

  // ==================== USER-RELATED ADMIN QUERIES ====================

  async getUserReportedContent(userId: string) {
    try {
      return await this._adminRepository.getUserReportedContent(userId);
    } catch (error: any) {
      logger.error("Error in getUserReportedContent service", { error: error.message });
      throw new CustomError(500, "Failed to get user reported content");
    }
  }

  async getUserReportsHistory(userId: string) {
    try {
      return await this._adminRepository.getUserReportsHistory(userId);
    } catch (error: any) {
      logger.error("Error in getUserReportsHistory service", { error: error.message });
      throw new CustomError(500, "Failed to get user reports history");
    }
  }
}

