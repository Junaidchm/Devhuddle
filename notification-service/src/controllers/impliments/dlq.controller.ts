import { Request, Response } from 'express';
import logger from '../../utils/logger.util';
import { DLQService } from '../../services/impliments/dlq.service';
import { IDLQService } from '../../services/interfaces/IDlqService';

export class DLQController {
  
  constructor(private dlqService: IDLQService ) {}

  /**
   * Get DLQ messages for manual review
   */
  async getDLQMessages(req: Request, res: Response): Promise<void> {
    try {
      const { 
        status = 'PENDING', 
        limit = 50, 
        offset = 0,
        originalTopic,
        startDate,
        endDate 
      } = req.query;

      const result = await this.dlqService.getDLQMessages({
        status: status as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        originalTopic: originalTopic as string,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
      });
      
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error fetching DLQ messages', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Retry DLQ message
   */
  async retryDLQMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      if (!id) {
        res.status(400).json({ error: 'DLQ message ID is required' });
        return;
      }

      const result = await this.dlqService.retryDLQMessage(id);
      
      res.status(200).json({
        success: true,
        message: 'DLQ message retry initiated',
        data: result,
      });
    } catch (error: any) {
      logger.error('Error retrying DLQ message', { error: error.message });
      
      if (error.message === 'DLQ message not found') {
        res.status(404).json({ error: 'DLQ message not found' });
      } else if (error.message === 'DLQ message already processed') {
        res.status(400).json({ error: 'DLQ message already processed' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Mark DLQ message as resolved
   */
  async resolveDLQMessage(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolution } = req.body;
      
      if (!id) {
        res.status(400).json({ error: 'DLQ message ID is required' });
        return;
      }

      await this.dlqService.resolveDLQMessage(id, resolution);
      
      res.status(200).json({
        success: true,
        message: 'DLQ message resolved',
      });
    } catch (error: any) {
      logger.error('Error resolving DLQ message', { error: error.message });
      
      if (error.message === 'DLQ message not found') {
        res.status(404).json({ error: 'DLQ message not found' });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  /**
   * Get DLQ statistics
   */
  async getDLQStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.dlqService.getDLQStats();
      
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error fetching DLQ stats', { error: error.message });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}