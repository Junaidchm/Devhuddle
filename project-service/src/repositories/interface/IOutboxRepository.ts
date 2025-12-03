import { OutboxEvent, OutboxStatus, OutboxAggregateType, OutboxEventType } from "@prisma/client";

export interface IOutboxRepository {
  createOutboxEvent(data: {
    aggregateType: OutboxAggregateType;
    aggregateId?: string;
    type: OutboxEventType;
    topic: string;
    key?: string;
    payload: any;
  }): Promise<OutboxEvent>;
  getPendingEvents(limit?: number): Promise<OutboxEvent[]>;
  updateEventStatus(
    id: string,
    status: OutboxStatus,
    attempts?: number,
    publishedAt?: Date
  ): Promise<OutboxEvent>;
  markEventAsSent(id: string): Promise<OutboxEvent>;
  markEventAsFailed(id: string, attempts: number): Promise<OutboxEvent>;
}

