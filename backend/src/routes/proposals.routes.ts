import { Router, RequestHandler } from 'express';
import { proposalAutomationController } from '../controllers/proposal-automation.controller';

const router = Router();

router.post(
  '/generate',
  proposalAutomationController.generate as unknown as RequestHandler,
);

export default router;

