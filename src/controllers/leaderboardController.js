import { LeaderboardService } from '../services/leaderboardService.js';

export const submitScore = async (req, res) => {
  try {
    const { score, gameType } = req.body;
    const { id: userId, username, region } = req.user;

    await LeaderboardService.submitScore(userId, username, score, gameType, region);
    res.status(200).json({ success: true, message: 'Score synchronized with NEUROXIS network.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRankings = async (req, res) => {
  try {
    const { gameType } = req.params;
    const { region = 'GLOBAL', limit = 50 } = req.query;
    const rankings = await LeaderboardService.getTopRankings(gameType, region, parseInt(limit));
    res.status(200).json({ success: true, gameType, region, data: rankings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};