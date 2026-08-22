import { redis } from '../config/redis.js';
import { User } from '../models/User.js';

/**
 * Production Redis Leaderboard Service for NEUROXIS
 */
export const leaderboardService = {
  /**
   * Upsert user score into Global, Regional, and District Redis Leaderboards
   * 
   * @param {Object} user 
   * @param {string} user.id 
   * @param {number} user.globalElo 
   * @param {string} user.region 
   * @param {string} user.district 
   */
  async updateUserRank(user) {
    try {
      if (!redis.status || redis.status !== 'ready') {
        await redis.connect();
      }

      const userId = user.id || user._id.toString();
      const score = user.globalElo || 1200;

      const pipeline = redis.pipeline();

      // 1. Global Leaderboard
      pipeline.zadd('leaderboard:global', score, userId);

      // 2. Regional Leaderboard
      if (user.region) {
        pipeline.zadd(`leaderboard:region:${user.region.toUpperCase()}`, score, userId);
      }

      // 3. District Leaderboard
      if (user.district) {
        pipeline.zadd(`leaderboard:district:${user.district.toLowerCase()}`, score, userId);
      }

      await pipeline.exec();
    } catch (err) {
      console.error('[Leaderboard Error] Failed to update rank:', err.message);
    }
  },

  /**
   * Fetch Paginated Leaderboard
   * 
   * @param {Object} params
   * @param {string} [params.type='global'] - 'global', 'region', or 'district'
   * @param {string} [params.filter=''] - Specific region name or district name
   * @param {number} [params.page=1]
   * @param {number} [params.limit=10]
   */
  async getLeaderboard({ type = 'global', filter = '', page = 1, limit = 10 }) {
    try {
      if (!redis.status || redis.status !== 'ready') {
        await redis.connect();
      }

      let key = 'leaderboard:global';
      if (type === 'region' && filter) {
        key = `leaderboard:region:${filter.toUpperCase()}`;
      } else if (type === 'district' && filter) {
        key = `leaderboard:district:${filter.toLowerCase()}`;
      }

      const start = (page - 1) * limit;
      const stop = start + limit - 1;

      // ZREVRANGE fetches highest scores first (Rank 0 = Score MAX)
      // WITHSCORES returns array: [userId1, score1, userId2, score2, ...]
      const rawResults = await redis.zrevrange(key, start, stop, 'WITHSCORES');
      const totalEntries = await redis.zcard(key);

      if (!rawResults.length) {
        return { total: 0, page, pageCount: 0, entries: [] };
      }

      // Parse [userId, score, userId, score] into formatted objects
      const userIds = [];
      const scoresMap = {};

      for (let i = 0; i < rawResults.length; i += 2) {
        const userId = rawResults[i];
        const score = parseInt(rawResults[i + 1], 10);
        userIds.push(userId);
        scoresMap[userId] = score;
      }

      // Populate user profiles from Mongo
      const users = await User.find({ _id: { $in: userIds } })
        .select('username region district level streak avatar')
        .lean();

      // Map profiles with exact rank position
      const entries = userIds
        .map((id, index) => {
          const profile = users.find((u) => u._id.toString() === id);
          if (!profile) return null;

          return {
            rank: start + index + 1,
            userId: id,
            username: profile.username,
            region: profile.region,
            district: profile.district,
            level: profile.level,
            streak: profile.streak?.currentStreak || 0,
            elo: scoresMap[id],
          };
        })
        .filter(Boolean);

      return {
        total: totalEntries,
        page,
        pageCount: Math.ceil(totalEntries / limit),
        entries,
      };
    } catch (err) {
      console.error('[Leaderboard Error] Failed to fetch leaderboard:', err.message);
      throw err;
    }
  },

  /**
   * Get specific user's rank and surrounding competitors
   * 
   * @param {string} userId 
   * @param {string} [type='global'] 
   * @param {string} [filter=''] 
   */
  async getUserRank(userId, type = 'global', filter = '') {
    try {
      if (!redis.status || redis.status !== 'ready') {
        await redis.connect();
      }

      let key = 'leaderboard:global';
      if (type === 'region' && filter) key = `leaderboard:region:${filter.toUpperCase()}`;
      if (type === 'district' && filter) key = `leaderboard:district:${filter.toLowerCase()}`;

      // ZREVRANK returns 0-indexed position (highest score = 0)
      const rankIndex = await redis.zrevrank(key, userId.toString());
      const score = await redis.zscore(key, userId.toString());

      if (rankIndex === null) {
        return { rank: null, elo: null };
      }

      return {
        rank: rankIndex + 1,
        elo: parseInt(score, 10),
      };
    } catch (err) {
      console.error('[Leaderboard Error] Failed to get user rank:', err.message);
      return { rank: null, elo: null };
    }
  },
};