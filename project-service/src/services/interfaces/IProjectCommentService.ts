import { ProjectComment } from "@prisma/client";

export interface IProjectCommentService {
  createComment(
    projectId: string,
    userId: string,
    content: string,
    parentCommentId?: string
  ): Promise<ProjectComment>;
  updateComment(
    commentId: string,
    userId: string,
    content: string
  ): Promise<ProjectComment>;
  deleteComment(commentId: string, userId: string): Promise<void>;
  getComments(
    projectId: string,
    limit?: number,
    offset?: number,
    userId?: string
  ): Promise<any[]>;
  getCommentCount(projectId: string): Promise<number>;
  getReplies(
    commentId: string,
    limit?: number,
    userId?: string
  ): Promise<any[]>;
}
