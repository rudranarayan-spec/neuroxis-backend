import { Router } from 'express';
import { createRoom, submitMoveTelemetry, settleGameResult } from '../controllers/gameController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/room/create', protect, createRoom);
router.post('/telemetry', protect, submitMoveTelemetry);
router.post('/settle', protect, settleGameResult);

export default router;