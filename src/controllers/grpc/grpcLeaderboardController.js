import { leaderboardService } from '../../services/leaderboardService.js';

export const grpcLeaderboardController = {
  // --- 1. Get Paginated Leaderboard RPC ---
  async getLeaderboard(req) {
    try {
      const type = req.type || 'global';
      const filter = req.filter || '';
      const page = req.page || 1;
      const limit = req.limit || 10;

      const data = await leaderboardService.getLeaderboard({
        type,
        filter,
        page: Number(page),
        limit: Number(limit),
      });

      const entries = data.entries.map((entry) => ({
        rank: entry.rank,
        userId: entry.userId,
        username: entry.username,
        region: entry.region || '',
        district: entry.district || '',
        level: entry.level || 1,
        streak: entry.streak || 0,
        elo: entry.elo || 1200,
      }));

      return {
        success: true,
        total: data.total,
        page: data.page,
        pageCount: data.pageCount,
        entries,
        error: '',
      };
    } catch (err) {
      return {
        success: false,
        total: 0,
        page: 1,
        pageCount: 0,
        entries: [],
        error: err.message,
      };
    }
  },

  // --- 2. Get User Rank RPC ---
  async getMyRank(req, context) {
    try {
      const userId = context?.userId || req.userId;
      const type = req.type || 'global';
      const filter = req.filter || '';

      if (!userId) {
        return {
          success: false,
          rank: 0,
          elo: 0,
          error: 'User ID context missing',
        };
      }

      const rankData = await leaderboardService.getUserRank(userId, type, filter);

      return {
        success: true,
        rank: rankData.rank || 0,
        elo: rankData.elo || 0,
        error: '',
      };
    } catch (err) {
      return {
        success: false,
        rank: 0,
        elo: 0,
        error: err.message,
      };
    }
  },
};