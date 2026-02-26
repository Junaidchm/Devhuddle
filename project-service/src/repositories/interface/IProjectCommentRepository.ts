import { ProjectComment, Prisma } from "@prisma/client";

export interface IProjectCommentRepository {
  createComment(data: {
    projectId: string;
    userId: string;
    content: string;
    parentCommentId?: string;
  }): Promise<ProjectComment>;
  updateComment(commentId: string, data: Partial<Prisma.ProjectCommentUpdateInput>): Promise<ProjectComment>;
  deleteComment(commentId: string): Promise<void>;
  findComment(commentId: string): Promise<ProjectComment | null>;
  getCommentsByProject(
    projectId: string,
    limit: number,
    offset: number,
    includeReplies?: boolean
  ): Promise<ProjectComment[]>;
  getCommentCount(projectId: string): Promise<number>;
  getReplies(commentId: string, limit?: number, offset?: number): Promise<ProjectComment[]>;
  getReplyCount(commentId: string): Promise<number>;
  incrementLikesCount(commentId: string): Promise<void>;
  decrementLikesCount(commentId: string): Promise<void>;
  getUserLikesForComments(userId: string, commentIds: string[]): Promise<Record<string, boolean>>;
}
