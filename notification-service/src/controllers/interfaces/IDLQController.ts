import { Request, Response } from 'express';

export interface IDLQController {
  /**
   * Get DLQ messages for manual review
   */
  getDLQMessages(req: Request, res: Response): Promise<void>;

  /**
   * Retry DLQ message
   */
  retryDLQMessage(req: Request, res: Response): Promise<void>;

  /**
   * Mark DLQ message as resolved
   */
  resolveDLQMessage(req: Request, res: Response): Promise<void>;

  /**
   * Get DLQ statistics
   */
  getDLQStats(req: Request, res: Response): Promise<void>;
}
