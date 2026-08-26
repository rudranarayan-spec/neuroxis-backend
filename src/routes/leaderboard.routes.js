import { Router } from 'express';
import { getLeaderboard, getMyRank } from '../controllers/leaderboardController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.get('/', protect, getLeaderboard);
router.get('/me', protect, getMyRank);

export default router;