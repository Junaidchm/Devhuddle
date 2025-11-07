import { DLQMessage, DLQQuery, DLQStats } from "../impliments/dlq.service";


export interface IDLQService {
  getDLQMessages(query: DLQQuery): Promise<{
    messages: DLQMessage[];
    total: number;
    hasMore: boolean;
  }>;

  retryDLQMessage(dlqId: string): Promise<{ success: boolean; message: string }>;

  resolveDLQMessage(dlqId: string, resolution: string): Promise<void>;

  getDLQStats(): Promise<DLQStats>;

  cleanupOldMessages(daysOld?: number): Promise<number>;
}
