import { DLQMessage, DLQQuery } from "../../services/impliments/dlq.service";


export interface IDLQRepository {
  findMany(query: DLQQuery): Promise<any[]>;
  count(query?: DLQQuery): Promise<number>;
  findById(id: string): Promise<any | null>;
  updateStatus(id: string, data: Partial<DLQMessage>): Promise<any>;
  groupByTopic(): Promise<any[]>;
  countRecentFailures(): Promise<number>;
  deleteOldResolved(daysOld: number): Promise<number>;
}
