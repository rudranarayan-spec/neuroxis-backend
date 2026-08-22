import { User } from "../../models/User.js";
import { Match } from "../../models/Match.js";
import { calculateMatchElo, calculateGlobalElo } from "../../utils/elo.js";
import {
  calculateMatchXp,
  processXpGain,
  processDailyStreak,
} from "../../utils/progression.js";

export const grpcMatchController = {
  // --- 1. Submit Match RPC ---
  async submitMatch(req, context) {
    try {
      // In gRPC context, user ID is extracted from metadata token by auth middleware
      const playerAId = context?.userId || req.playerAId;

      const {
        gameCategory,
        mode = "SOLO",
        opponentId,
        scoreA,
        scoreB = 0,
        durationMs,
        puzzleSeed,
        moveLog = [],
      } = req;

      if (!gameCategory || scoreA === undefined || !durationMs || !puzzleSeed) {
        return {
          success: false,
          error: "Missing required game submission parameters",
        };
      }

      const playerA = await User.findById(playerAId);
      if (!playerA) {
        return { success: false, error: "Player not found" };
      }

      let winnerId = null;
      let isDraw = false;
      let eloDeltaA = 0;
      let eloDeltaB = 0;
      let playerB = null;

      // Handle 1v1 Mode
      if (mode === "DUEL_1V1" && opponentId) {
        playerB = await User.findById(opponentId);
        if (!playerB) {
          return { success: false, error: "Opponent not found" };
        }

        let scoreVectorA = 0.5;
        if (scoreA > scoreB) {
          scoreVectorA = 1;
          winnerId = playerA._id;
        } else if (scoreB > scoreA) {
          scoreVectorA = 0;
          winnerId = playerB._id;
        } else {
          isDraw = true;
        }

        const currentRatingA = playerA.gameElo[gameCategory] || 1200;
        const currentRatingB = playerB.gameElo[gameCategory] || 1200;

        const eloResult = calculateMatchElo({
          ratingA: currentRatingA,
          ratingB: currentRatingB,
          scoreA: scoreVectorA,
        });

        playerA.gameElo[gameCategory] = eloResult.playerA.newRating;
        playerA.globalElo = calculateGlobalElo(playerA.gameElo);
        eloDeltaA = eloResult.playerA.delta;

        playerB.gameElo[gameCategory] = eloResult.playerB.newRating;
        playerB.globalElo = calculateGlobalElo(playerB.gameElo);
        eloDeltaB = eloResult.playerB.delta;

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

      // Player A Progression
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

      // Record Match
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

      return {
        success: true,
        matchId: matchRecord._id.toString(),
        xpGained: xpGainedA,
        leveledUp,
        newLevel: playerA.level,
        currentStreak: playerA.streak.currentStreak,
        globalElo: playerA.globalElo,
        categoryElo: playerA.gameElo[gameCategory],
        eloChange: eloDeltaA,
        error: "",
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // --- 2. Get Match History RPC ---
  async getMatchHistory(req, context) {
    try {
      const userId = context?.userId || req.userId;
      const page = req.page || 1;
      const limit = req.limit || 10;

      const matches = await Match.find({
        $or: [{ playerA: userId }, { playerB: userId }],
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("playerA", "username")
        .populate("playerB", "username")
        .populate("winner", "username");

      const matchItems = matches.map((m) => ({
        id: m._id.toString(),
        gameCategory: m.gameCategory,
        mode: m.mode,
        playerAId: m.playerA?._id?.toString() || "",
        playerAUsername: m.playerA?.username || "",
        playerBId: m.playerB?._id?.toString() || "",
        playerBUsername: m.playerB?.username || "",
        scoreA: m.scoreA,
        scoreB: m.scoreB,
        winnerId: m.winner?._id?.toString() || "",
        isDraw: m.isDraw,
        playerAEloChange: m.playerAEloChange,
        durationMs: m.durationMs,
        createdAt: m.createdAt.toISOString(),
      }));

      return {
        success: true,
        count: matchItems.length,
        page: Number(page),
        matches: matchItems,
        error: "",
      };
    } catch (err) {
      return { success: false, matches: [], error: err.message };
    }
  },
};
