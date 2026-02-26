export interface IProjectSendService {
  sendProject(
    projectId: string,
    senderId: string,
    recipientIds: string[],
    message?: string
  ): Promise<{
    success: boolean;
    sentTo: string[];
    message?: string;
  }>;
}
