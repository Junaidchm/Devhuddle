export interface IMentionService {
    processMentions(
      content: string,
      projectId?: string,
      commentId?: string,
      actorId?: string
    ): Promise<string[]>; // Returns array of mentioned user IDs
  }
