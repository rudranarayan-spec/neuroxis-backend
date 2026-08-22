import { User } from "../models/User.js";
import { Match } from "../models/Match.js";
import { calculateMatchElo, calculateGlobalElo } from "../utils/elo.js";
import {
  calculateMatchXp,
  processXpGain,
  processDailyStreak,
} from "../utils/progression.js";
import { leaderboardService } from "../services/leaderboardService.js";

export const submitMatch = async (req, res) => {
  try {
    const {
      gameCategory,
      mode = "SOLO",
      opponentId,
      scoreA,
      scoreB = 0,
      durationMs,
      puzzleSeed,
      moveLog = [],
    } = req.body;

    const playerAId = req.user.id; // Extracted from Auth middleware

    // 1. Basic Validation
    if (!gameCategory || scoreA === undefined || !durationMs || !puzzleSeed) {
      return res.status(400).json({
        success: false,
        error: "Missing required game submission parameters",
      });
    }

    const playerA = await User.findById(playerAId);
    if (!playerA) {
      return res
        .status(404)
        .json({ success: false, error: "Player not found" });
    }

    // Initialize Variables
    let winnerId = null;
    let isDraw = false;
    let eloDeltaA = 0;
    let eloDeltaB = 0;
    let playerB = null;

    // --- 2. HANDLE 1v1 DUEL MODE ---
    if (mode === "DUEL_1V1" && opponentId) {
      playerB = await User.findById(opponentId);
      if (!playerB) {
        return res
          .status(404)
          .json({ success: false, error: "Opponent not found" });
      }

      // Determine Winner & Score Vector
      let scoreVectorA = 0.5; // Default Draw
      if (scoreA > scoreB) {
        scoreVectorA = 1; // Player A Wins
        winnerId = playerA._id;
      } else if (scoreB > scoreA) {
        scoreVectorA = 0; // Player B Wins
        winnerId = playerB._id;
      } else {
        isDraw = true;
      }

      // Calculate Elo Ratings
      const currentRatingA = playerA.gameElo[gameCategory] || 1200;
      const currentRatingB = playerB.gameElo[gameCategory] || 1200;

      const eloResult = calculateMatchElo({
        ratingA: currentRatingA,
        ratingB: currentRatingB,
        scoreA: scoreVectorA,
      });

      // Update Player A Category & Global Elo
      playerA.gameElo[gameCategory] = eloResult.playerA.newRating;
      playerA.globalElo = calculateGlobalElo(playerA.gameElo);
      eloDeltaA = eloResult.playerA.delta;

      // Update Player B Category & Global Elo
      playerB.gameElo[gameCategory] = eloResult.playerB.newRating;
      playerB.globalElo = calculateGlobalElo(playerB.gameElo);
      eloDeltaB = eloResult.playerB.delta;

      // Update Player B Streak & Progression
      const isPlayerBWin =
        winnerId && winnerId.toString() === playerB._id.toString();
      const xpGainedB = calculateMatchXp({
        score: scoreB,
        isWin: isPlayerBWin,
        mode,
      });
      const { newXp: newXpB, newLevel: newLevelB } = processXpGain(
        playerB.xp,
        xpGainedB,
        playerB.level,
      );

      playerB.xp = newXpB;
      playerB.level = newLevelB;
      playerB.streak = processDailyStreak(playerB.streak);

      await playerB.save();
    }

    // --- 3. PROCESS PLAYER A PROGRESSION & STREAKS ---
    const isPlayerAWin =
      mode === "SOLO" ||
      (winnerId && winnerId.toString() === playerA._id.toString());
    const xpGainedA = calculateMatchXp({
      score: scoreA,
      isWin: isPlayerAWin,
      mode,
    });
    const {
      newXp: newXpA,
      newLevel: newLevelA,
      leveledUp,
    } = processXpGain(playerA.xp, xpGainedA, playerA.level);

    playerA.xp = newXpA;
    playerA.level = newLevelA;
    playerA.streak = processDailyStreak(playerA.streak);

    await playerA.save();

    // Sync new Elo to Redis Leaderboard
    await leaderboardService.updateUserRank(playerA);
    if (playerB) {
      await leaderboardService.updateUserRank(playerB);
    }

    // --- 4. RECORD MATCH RECORD IN MONGO ---
    const matchRecord = await Match.create({
      gameCategory,
      mode,
      playerA: playerA._id,
      playerB: playerB ? playerB._id : null,
      scoreA,
      scoreB,
      winner: winnerId,
      isDraw,
      playerAEloChange: eloDeltaA,
      playerBEloChange: eloDeltaB,
      durationMs,
      puzzleSeed,
      moveLog,
    });

    res.status(201).json({
      success: true,
      data: {
        matchId: matchRecord._id,
        xpGained: xpGainedA,
        leveledUp,
        newLevel: playerA.level,
        currentStreak: playerA.streak.currentStreak,
        globalElo: playerA.globalElo,
        categoryElo: playerA.gameElo[gameCategory],
        eloChange: eloDeltaA,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMatchHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const matches = await Match.find({
      $or: [{ playerA: userId }, { playerB: userId }],
    })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("playerA", "username region globalElo")
      .populate("playerB", "username region globalElo")
      .populate("winner", "username");

    res.status(200).json({
      success: true,
      count: matches.length,
      page: Number(page),
      matches,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
