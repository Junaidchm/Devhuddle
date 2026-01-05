import { Prisma, OutboxAggregateType, OutboxEventType } from "@prisma/client";

export interface IOutboxService {
  createOutboxEvent(data: {
    aggregateType: OutboxAggregateType;
    aggregateId?: string;
    type: OutboxEventType;
    topic: string;
    key?: string;
    payload: Prisma.InputJsonValue;
  }): Promise<void>;
}

