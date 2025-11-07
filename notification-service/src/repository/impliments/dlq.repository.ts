import prisma from '../../config/prisma.config';
import { DLQQuery } from '../../services/impliments/dlq.service';
import { BaseRepository } from './base.repository';
import { DlqEvent, Prisma } from "@prisma/client";

export class DLQRepository extends BaseRepository<
typeof prisma.dlqEvent,
DlqEvent,
Prisma.DlqEventCreateInput,
Prisma.DlqEventUpdateInput,
Prisma.DlqEventWhereUniqueInput
> {

  constructor() {
    super(prisma.dlqEvent)
  }
  
  async findMany(query: DLQQuery)  {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.originalTopic) where.originalTopic = query.originalTopic;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }
    return prisma.dlqEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit,
      skip: query.offset,
    });
  }

  async count(query: DLQQuery) {
    const where: any = {};
    if (query.status) where.status = query.status;
    if (query.originalTopic) where.originalTopic = query.originalTopic;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = query.startDate;
      if (query.endDate) where.createdAt.lte = query.endDate;
    }
    return prisma.dlqEvent.count({ where });
  }

  async findById(id: string) {
    return prisma.dlqEvent.findUnique({ where: { id } });
  }

  async updateStatus(id: string, data: any) {
    return prisma.dlqEvent.update({ where: { id }, data });
  }

  async groupByTopic() {
    return prisma.dlqEvent.groupBy({
      by: ['originalTopic'],
      _count: { id: true },
    });
  }

  async countRecentFailures() {
    return prisma.dlqEvent.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    });
  }

  async deleteOldResolved(daysOld: number) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const result = await prisma.dlqEvent.deleteMany({
      where: {
        status: 'RESOLVED',
        updatedAt: { lt: cutoffDate },
      },
    });
    return result.count;
  }
}
