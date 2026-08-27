import { redis } from "../config/redis.js";
import { User } from "../models/User.js";

const getLeaderboardKey = (type, filter) => {
  switch (type) {
    case "region":
      return `leaderboard:region:${filter.toUpperCase()}`;
    case "district":
      return `leaderboard:district:${filter.toLowerCase()}`;
    case "game":
      return `leaderboard:game:${filter.toLowerCase()}`;
    case "xp":
      return `leaderboard:xp`;
    case "global":
    default:
      return `leaderboard:global`;
  }
};

export const leaderboardService = {
  async updateUserRank(user) {
    try {
      if (redis.status !== "ready") await redis.connect();

      const userId = user.id || user._id.toString();
      const pipeline = redis.pipeline();

      // 1. Global ELO
      if (user.globalElo !== undefined) {
        pipeline.zadd("leaderboard:global", user.globalElo, userId);
      }

      // 2. XP Leaderboard
      if (user.xp !== undefined) {
        pipeline.zadd("leaderboard:xp", user.xp, userId);
      }

      // 3. Regional Leaderboard
      if (user.region && user.globalElo !== undefined) {
        pipeline.zadd(
          `leaderboard:region:${user.region.toUpperCase()}`,
          user.globalElo,
          userId,
        );
      }

      // 4. District Leaderboard
      if (user.district && user.globalElo !== undefined) {
        pipeline.zadd(
          `leaderboard:district:${user.district.toLowerCase()}`,
          user.globalElo,
          userId,
        );
      }

      // 5. Per-Game ELO (If user has gameElo map)
      if (user.gameElo && typeof user.gameElo === "object") {
        for (const [gameType, score] of Object.entries(user.gameElo)) {
          pipeline.zadd(
            `leaderboard:game:${gameType.toLowerCase()}`,
            score,
            userId,
          );
        }
      }

      await pipeline.exec();
    } catch (err) {
      console.error("[Leaderboard Error] Failed to update rank:", err.message);
    }
  },

  async getLeaderboard({ type = "global", filter = "", page = 1, limit = 20 }) {
    try {
      if (redis.status !== "ready") await redis.connect();

      const key = getLeaderboardKey(type, filter);
      const start = (page - 1) * limit;
      const stop = start + limit - 1;

      // ZREVRANGE retrieves items sorted from highest to lowest score
      const rawResults = await redis.zrevrange(key, start, stop, "WITHSCORES");
      const totalEntries = await redis.zcard(key);

      if (!rawResults.length) {
        return { total: 0, page, pageCount: 0, entries: [] };
      }

      const userIds = [];
      const scoresMap = {};

      for (let i = 0; i < rawResults.length; i += 2) {
        const id = rawResults[i];
        const score = parseInt(rawResults[i + 1], 10);
        userIds.push(id);
        scoresMap[id] = score;
      }

      // Populate user profiles from MongoDB
      const users = await User.find({ _id: { $in: userIds }, isBanned: false })
        .select("username region district level streak avatar xp globalElo")
        .lean();

      // Maintain order returned by Redis ZREVRANGE
      const entries = userIds
        .map((id, index) => {
          const profile = users.find((u) => u._id.toString() === id);
          if (!profile) return null;

          return {
            rank: start + index + 1,
            userId: id,
            username: profile.username,
            avatar: profile.avatar || null,
            region: profile.region,
            district: profile.district,
            level: profile.level,
            streak: profile.streak?.currentStreak || 0,
            score: scoresMap[id],
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
      console.error(
        "[Leaderboard Error] Failed to fetch leaderboard:",
        err.message,
      );
      throw err;
    }
  },

  /**
   * Get specific user rank
   */
  async getUserRank(userId, type = "global", filter = "") {
    try {
      if (redis.status !== "ready") await redis.connect();

      const key = getLeaderboardKey(type, filter);
      const rankIndex = await redis.zrevrank(key, userId.toString());
      const score = await redis.zscore(key, userId.toString());

      if (rankIndex === null) {
        return { rank: null, score: null };
      }

      return {
        rank: rankIndex + 1,
        score: parseInt(score, 10),
      };
    } catch (err) {
      console.error(
        "[Leaderboard Error] Failed to get user rank:",
        err.message,
      );
      return { rank: null, score: null };
    }
  },
};
