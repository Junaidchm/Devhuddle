import { OutboxAggregateType, OutboxEventType } from "@prisma/client";

export interface IOutboxService {
  createOutboxEvent(data: {
    aggregateType: OutboxAggregateType;
    aggregateId?: string;
    type: OutboxEventType;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<void>;
}

