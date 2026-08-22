import { leaderboardService } from '../services/leaderboardService.js';

export const getLeaderboard = async (req, res) => {
  try {
    const { type = 'global', filter = '', page = 1, limit = 10 } = req.query;

    const data = await leaderboardService.getLeaderboard({
      type,
      filter,
      page: Number(page),
      limit: Number(limit),
    });

    res.status(200).json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMyRank = async (req, res) => {
  try {
    const { type = 'global', filter = '' } = req.query;
    const userId = req.user.id;

    const rankData = await leaderboardService.getUserRank(userId, type, filter);

    res.status(200).json({ success: true, ...rankData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};