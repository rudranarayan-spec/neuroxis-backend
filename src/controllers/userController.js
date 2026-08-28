import { GameSession } from "../models/GameSession.js";
import { Match } from "../models/Match.js";
import { User } from "../models/User.js";
import { userService } from "../services/userService.js";

export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await userService.getUserProfile(userId);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Avatar URL is required" });
    }

    const updatedUser = await userService.updateAvatar(userId, avatarUrl);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Both current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters long",
      });
    }

    await userService.changePassword(userId, currentPassword, newPassword);
    res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const stats = await userService.getUserStats(userId);
    res.status(200).json({ success: true, stats });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

export const getUserDashboardStats = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { timeframe = "ALL_TIME" } = req.query;

    // Fetch latest user document to get current streak & globalElo
    const currentUser = await User.findById(userId);

    // Build time filter range
    let dateFilter = {};
    const now = new Date();

    if (timeframe === "TODAY") {
      const startOfDay = new Date(now.setHours(0, 0, 0, 0));
      dateFilter = { createdAt: { $gte: startOfDay } };
    } else if (timeframe === "7_DAYS") {
      const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
      dateFilter = { createdAt: { $gte: sevenDaysAgo } };
    } else if (timeframe === "30_DAYS") {
      const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));
      dateFilter = { createdAt: { $gte: thirtyDaysAgo } };
    }

    // 1. Fetch user matches
    const matchQuery = {
      $or: [{ playerA: userId }, { playerB: userId }],
      ...dateFilter,
    };

    const matches = await Match.find(matchQuery);

    let wins = 0;
    let losses = 0;
    let draws = 0;

    matches.forEach((match) => {
      if (match.isDraw) {
        draws++;
      } else if (
        match.winner &&
        match.winner.toString() === userId.toString()
      ) {
        wins++;
      } else {
        losses++;
      }
    });

    const totalMatchesPlayed = matches.length;
    const winRate =
      totalMatchesPlayed > 0
        ? Number(((wins / totalMatchesPlayed) * 100).toFixed(1))
        : 0;

    // 2. Fetch total game sessions
    const totalSessions = await GameSession.countDocuments({
      userId,
      ...dateFilter,
    });

    // Calculate dynamic user stats
    const statsData = {
      username: currentUser?.username || "Gamer",
      level: currentUser?.level || 1,
      totalXp: currentUser?.xp || 0,
      rankTitle: "CYBER_LEGEND 1",
      rankPercentile: "Top 2%",
      mmrRating: currentUser?.globalElo || 1200, 
      winRate: `${winRate}%`,
      winStreak: `${currentUser?.streak?.currentStreak || 0} DAYS`,
      liveArenasJoined: totalSessions,
      winLossRatio: `${wins} : ${losses}`,
      totalMatches: totalMatchesPlayed,
    };

    return res.status(200).json({
      success: true,
      data: statsData,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user dashboard stats",
      error: error.message,
    });
  }
};

export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;

    // 1. Fetch user profile data
    const user = await User.findById(userId).select("username email level globalElo");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 2. Compute dynamic leaderboard rank position based on globalElo
    const higherRankedCount = await User.countDocuments({
      globalElo: { $gt: user.globalElo || 1200 },
    });
    const leaderboardRank = `#${higherRankedCount + 1}`;

    // 3. Compute match metrics
    const matchQuery = {
      $or: [{ playerA: userId }, { playerB: userId }],
    };

    const totalMatches = await Match.countDocuments(matchQuery);
    
    let winRate = "0.0%";
    if (totalMatches > 0) {
      const wins = await Match.countDocuments({
        winner: userId,
      });
      winRate = `${((wins / totalMatches) * 100).toFixed(1)}%`;
    }

    // 4. Construct response tailored to UI requirements
    return res.status(200).json({
      success: true,
      data: {
        username: user.username,
        email: user.email,
        level: user.level || 1,
        levelTitle: `LEVEL ${user.level || 1} OPERATOR`,
        stats: {
          matches: totalMatches,
          winRate: winRate,
          rank: leaderboardRank,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user profile",
      error: error.message,
    });
  }
};