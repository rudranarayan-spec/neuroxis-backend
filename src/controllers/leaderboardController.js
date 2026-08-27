import { leaderboardService } from "../services/leaderboardService.js";

/**
 * GET /api/leaderboard
 * Fetch paginated leaderboard entries via Redis cache
 */
export const getLeaderboard = async (req, res) => {
  try {
    const {
      type = "global", // 'global', 'region', 'district', 'game', 'xp'
      filter = "",     // e.g. 'US-CA', 'district-9', or 'sudoku'
      page = 1,
      limit = 20,
    } = req.query;

    const result = await leaderboardService.getLeaderboard({
      type,
      filter,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });

    return res.status(200).json({
      success: true,
      data: result.entries,
      pagination: {
        total: result.total,
        page: result.page,
        pageCount: result.pageCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/leaderboard/me
 * Fetch authenticated user rank and score
 */
export const getMyRank = async (req, res) => {
  try {
    const { type = "global", filter = "" } = req.query;
    const userId = req.user.id;

    const rankData = await leaderboardService.getUserRank(userId, type, filter);

    return res.status(200).json({ 
      success: true, 
      data: rankData 
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};