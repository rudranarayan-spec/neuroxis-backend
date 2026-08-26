import { User } from "../models/User.js";
import { leaderboardService } from "../services/leaderboardService.js";

export const getLeaderboard = async (req, res) => {
  try {
    const {
      category = "global",
      region,
      gameType,
      limit = 50,
      page = 1,
    } = req.query;
    const skip = (page - 1) * limit;

    let query = { isBanned: false };
    let sortField = {};

    // 1. Determine Sort Criteria
    if (category === "regional" && region) {
      query.region = region.toUpperCase();
      sortField = { globalElo: -1 };
    } else if (category === "game" && gameType) {
      sortField = { [`gameElo.${gameType}`]: -1 };
    } else if (category === "xp") {
      sortField = { xp: -1 };
    } else {
      // Default: Global Elo
      sortField = { globalElo: -1 };
    }

    // 2. Fetch Leaderboard Entries
    // Dynamic Rank Pipeline Query Example
    const leaderboard = await User.aggregate([
      { $match: { isBanned: false } },
      { $sort: { globalElo: -1 } },
      {
        $group: {
          _id: null,
          users: { $push: "$$ROOT" },
        },
      },
      { $unwind: { path: "$users", includeArrayIndex: "rank" } },
      {
        $project: {
          _id: "$users._id",
          username: "$users.username",
          globalElo: "$users.globalElo",
          level: "$users.level",
          region: "$users.region",
          rank: { $add: ["$rank", 1] }, // Converts 0-indexed array position into 1-based rank (#1, #2, #3...)
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);

    // 3. Map Rank Numbers
    const rankedData = leaderboard.map((user, index) => ({
      rank: skip + index + 1,
      id: user._id,
      username: user.username,
      region: user.region,
      level: user.level,
      elo:
        category === "game" && gameType
          ? user.gameElo[gameType]
          : user.globalElo,
      xp: user.xp,
      streak: user.streak?.currentStreak || 0,
    }));

    return res.status(200).json({
      success: true,
      data: rankedData,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyRank = async (req, res) => {
  try {
    const { type = "global", filter = "" } = req.query;
    const userId = req.user.id;

    const rankData = await leaderboardService.getUserRank(userId, type, filter);

    res.status(200).json({ success: true, ...rankData });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
