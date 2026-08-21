import { Router } from 'express';
import { submitScore, getRankings } from '../controllers/leaderboardController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/submit', protect, submitScore);
router.get('/:gameType', getRankings);

export default router;