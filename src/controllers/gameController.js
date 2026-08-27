import { Puzzle } from "../models/Puzzle.js";
import { GameSession } from "../models/GameSession.js";
import { User } from "../models/User.js";
import { updateDailyStreak } from "../utils/updateStreak.js";
import { validateShikakuSolution } from "../utils/shikakuGenerator.js";

// 1. Fetch a random puzzle board (hides solution)
export const getPuzzle = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { difficulty = "EASY", gridSize = 6 } = req.query;

    const count = await Puzzle.countDocuments({
      gameId,
      difficulty,
      gridSize: Number(gridSize),
    });

    if (count === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No puzzles found for this mode." });
    }

    const random = Math.floor(Math.random() * count);
    const puzzle = await Puzzle.findOne({
      gameId,
      difficulty,
      gridSize: Number(gridSize),
    })
      .skip(random)
      .select("-solution");

    return res.status(200).json({ success: true, puzzle });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 2. Start a new game session
export const startGame = async (req, res) => {
  try {
    const { gameId, puzzleId } = req.body;
    const userId = req.user._id;

    const session = await GameSession.create({
      userId,
      gameId,
      puzzleId: puzzleId || null,
      startTime: new Date(),
    });

    return res.status(201).json({
      success: true,
      sessionId: session._id,
      startTime: session.startTime,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

// 3. Submit solution, verify board, update User XP & Daily Streak
export const submitGame = async (req, res) => {
  try {
    const { sessionId, userBoard, rects, clientTimeElapsed } = req.body;
    const userId = req.user._id;

    const session = await GameSession.findById(sessionId);
    if (!session || session.status !== "IN_PROGRESS") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired session." });
    }

    const puzzle = await Puzzle.findById(session.puzzleId);
    if (!puzzle) {
      return res
        .status(404)
        .json({ success: false, message: "Puzzle template missing." });
    }

    let isCorrect = false;
    let failureReason = "Solution incorrect.";

    // GAME ROUTING LOGIC
    if (session.gameId === "shikaku") {
      // Validate Shikaku dynamically via geometry & clue rules
      const validation = validateShikakuSolution(
        puzzle.board,
        rects,
        puzzle.gridSize,
      );
      isCorrect = validation.valid;
      if (!isCorrect) failureReason = validation.message;
    } else {
      // Direct Matrix Comparison for Sudoku / standard grid games
      isCorrect = JSON.stringify(userBoard) === JSON.stringify(puzzle.solution);
    }

    if (!isCorrect) {
      return res.status(400).json({
        success: false,
        message: failureReason,
      });
    }

    // Calculate duration & XP
    const endTime = new Date();
    const durationInSeconds = Math.floor(
      (endTime - new Date(session.startTime)) / 1000,
    );

    let xpEarned =
      puzzle.gridSize === 5 ? 40 : puzzle.gridSize === 7 ? 80 : 120;
    if (clientTimeElapsed < 120) xpEarned += 20;

    // Finalize Game Session
    session.status = "COMPLETED";
    session.endTime = endTime;
    session.durationInSeconds = durationInSeconds;
    session.xpEarned = xpEarned;
    await session.save();

    // Update User XP, Game-Specific Elo & Daily Streak
    const user = await User.findById(userId);

    if (user) {
      await updateDailyStreak(user);

      user.xp = (user.xp || 0) + xpEarned;

      // Update Game-Specific Elo rating for Shikaku
      if (!user.gameElo) user.gameElo = {};
      user.gameElo.shikaku = (user.gameElo?.shikaku || 1200) + 15;
      user.globalElo = (user.globalElo || 1200) + 10;

      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: "VICTORY! Grid decrypted.",
      xpEarned,
      durationInSeconds,
      currentStreak: user?.streak?.currentStreak || 1,
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
};

export const abandonGameSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { durationInSeconds } = req.body;

    const session = await GameSession.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Game session not found" });
    }

    if (session.status !== "IN_PROGRESS") {
      return res.status(400).json({
        message: `Cannot abandon session with status: ${session.status}`,
      });
    }

    session.status = "ABANDONED";
    session.endTime = new Date();
    if (durationInSeconds) {
      session.durationInSeconds = durationInSeconds;
    }

    await session.save();

    return res.status(200).json({
      message: "Game session marked as abandoned successfully.",
      session,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to abandon game session",
      error: error.message,
    });
  }
};
