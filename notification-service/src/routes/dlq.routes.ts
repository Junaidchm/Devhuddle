import { Router } from "express";
import { DLQRepository } from "../repository/impliments/dlq.repository";
import { DLQService } from "../services/impliments/dlq.service";
import { DLQController } from "../controllers/impliments/dlq.controller";


const router = Router();
const dlqrepo = new DLQRepository();
const dlqService = new DLQService(dlqrepo);
const dlqController = new DLQController(dlqService);

router
  .get('/', dlqController.getDLQMessages.bind(dlqController))
  .post('/:id/retry', dlqController.retryDLQMessage.bind(dlqController))
  .post('/:id/resolve', dlqController.resolveDLQMessage.bind(dlqController))
  .get('/stats', dlqController.getDLQStats.bind(dlqController));

export default router;