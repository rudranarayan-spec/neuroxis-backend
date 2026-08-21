import express from 'express';
import { protect } from '../middleware/auth.js';
import { LeaderboardService } from '../services/leaderboardService.js';

const router = express.Router();

// Protected route: require valid JWT
router.post('/submit', protect, async (req, res) => {
  try {
    const { score, gameType } = req.body;
    const { id: userId, username, region } = req.user;

    await LeaderboardService.submitScore(userId, username, score, gameType, region);
    res.status(200).json({ success: true, message: 'Score synchronized with NEUROXIS network.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;