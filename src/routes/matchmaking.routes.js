import { Router } from 'express';
import {
  joinMatchmaking,
  pollMatchmakingStatus,
  cancelMatchmaking,
  createPrivateRoom,
  joinPrivateRoom,
} from '../controllers/matchmakingController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/join', protect, joinMatchmaking);
router.get('/status', protect, pollMatchmakingStatus);
router.post('/cancel', protect, cancelMatchmaking);
router.post('/private/create', protect, createPrivateRoom);
router.post('/private/join', protect, joinPrivateRoom);

export default router;