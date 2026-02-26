import { ProjectCommentMention } from "@prisma/client";

export interface IMentionRepository {
  createProjectMention(data: {
    projectId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<any>; // Need to check if there is a ProjectMention model, but we added ProjectCommentMention
  createCommentMention(data: {
    commentId: string;
    mentionedUserId: string;
    actorId: string;
  }): Promise<ProjectCommentMention>;
  getProjectMentions(projectId: string): Promise<any[]>;
  getCommentMentions(commentId: string): Promise<ProjectCommentMention[]>;
  deleteProjectMentions(projectId: string): Promise<void>;
  deleteCommentMentions(commentId: string): Promise<void>;
}
