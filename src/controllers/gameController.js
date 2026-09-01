import { Puzzle } from "../models/Puzzle.js";
import { GameSession } from "../models/GameSession.js";
import { User } from "../models/User.js";
import { updateDailyStreak } from "../utils/updateStreak.js";
import { validateShikakuSolution } from "../utils/shikakuGenerator.js";
import { generateEchoSequence } from "../utils/echoPatternGenerator.js";
import { getRandomWord } from "../utils/wordGenerator.js";

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
    const {
      gameId,
      sequenceLength = 5,
      gridSize = 9,
      difficulty = "MEDIUM",
    } = req.body;
    const userId = req.user._id;

    // Handle Word Game
    if (gameId === "wordGame") {
      const targetWord = getRandomWord(difficulty);

      const session = await GameSession.create({
        userId,
        gameId,
        puzzleId: null,
        targetWord,
        startTime: new Date(),
      });

      return res.status(201).json({
        success: true,
        sessionId: session._id,
        wordLength: targetWord.length, // Send length to frontend, hide the actual word
        startTime: session.startTime,
      });
    }

    // Handle Echo Pattern (dynamic sequence generation)
    if (gameId === "echoPattern" || gameId === "memory") {
      const generatedSequence = generateEchoSequence(
        Number(sequenceLength),
        Number(gridSize),
      );

      const session = await GameSession.create({
        userId,
        gameId,
        puzzleId: null,
        startTime: new Date(),
        targetSequence: generatedSequence,
      });

      return res.status(201).json({
        success: true,
        sessionId: session._id,
        sequence: generatedSequence,
        startTime: session.startTime,
      });
    }

    // Existing Logic for Sudoku / Shikaku
    const session = await GameSession.create({
      userId,
      gameId,
      puzzleId: req.body.puzzleId || null,
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
    const {
      sessionId,
      userSequence,
      userBoard,
      submittedWord,
      rects,
      clientTimeElapsed,
      attemptNumber = 1,
    } = req.body;
    const userId = req.user._id;

    const session = await GameSession.findById(sessionId);
    if (!session || session.status !== "IN_PROGRESS") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired session." });
    }

    // ─────────────────────────────────────────────────────────────────
    // WORD GAME HANDLER
    // ─────────────────────────────────────────────────────────────────
    if (session.gameId === "wordGame") {
      const cleanGuess = submittedWord?.trim().toUpperCase() || "";
      const targetWord = session.targetWord?.toUpperCase() || "";

      if (!cleanGuess) {
        return res
          .status(400)
          .json({ success: false, message: "No word provided." });
      }

      // Compute Wordle-style feedback array (['correct', 'present', 'absent'])
      const feedback = computeWordleFeedback(cleanGuess, targetWord);
      const isCorrect = cleanGuess === targetWord;

      // 1. INCORRECT GUESS - ATTEMPTS REMAINING
      if (!isCorrect && attemptNumber < 6) {
        return res.status(200).json({
          success: false,
          isCorrect: false,
          feedback,
          message: "Incorrect guess. Keep trying!",
        });
      }

      // 2. INCORRECT GUESS - OUT OF ATTEMPTS (GAME OVER / LOSS)
      if (!isCorrect && attemptNumber >= 6) {
        session.status = "COMPLETED";
        session.endTime = new Date();
        await session.save();

        return res.status(200).json({
          success: false,
          isCorrect: false,
          isGameOver: true,
          feedback,
          correctWord: targetWord,
          message: "Out of attempts! Game over.",
        });
      }

      // 3. CORRECT GUESS - WINNER (Finalize session and calculate XP/Streak)
      const endTime = new Date();
      const durationInSeconds = Math.floor(
        (endTime - new Date(session.startTime)) / 1000,
      );

      let xpEarned = (targetWord.length || 5) * 12;
      if (clientTimeElapsed && clientTimeElapsed < 10) xpEarned += 25;

      session.status = "COMPLETED";
      session.endTime = endTime;
      session.durationInSeconds = durationInSeconds;
      session.xpEarned = xpEarned;
      await session.save();

      const user = await User.findById(userId);
      if (user) {
        await updateDailyStreak(user);
        user.xp = (user.xp || 0) + xpEarned;

        if (!user.gameElo) user.gameElo = {};
        user.gameElo.wordGame = (user.gameElo?.wordGame || 1200) + 12;
        user.globalElo = (user.globalElo || 1200) + 8;

        await user.save();
      }

      return res.status(200).json({
        success: true,
        isCorrect: true,
        feedback,
        xpEarned,
        durationInSeconds,
        currentStreak: user?.streak?.currentStreak || 1,
        message: "WORD GUESSED CORRECTLY!",
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // OTHER GAMES ROUTING LOGIC (ECHO, SHIKAKU, SUDOKU)
    // ─────────────────────────────────────────────────────────────────
    let isCorrect = false;
    let failureReason = "Incorrect guess.";

    if (session.gameId === "echoPattern" || session.gameId === "memory") {
      isCorrect =
        JSON.stringify(userSequence) === JSON.stringify(session.targetSequence);
      if (!isCorrect) failureReason = "Sequence incorrect.";
    } else if (session.gameId === "shikaku") {
      const puzzle = await Puzzle.findById(session.puzzleId);
      if (!puzzle)
        return res
          .status(404)
          .json({ success: false, message: "Puzzle missing." });

      const validation = validateShikakuSolution(
        puzzle.board,
        rects,
        puzzle.gridSize,
      );
      isCorrect = validation.valid;
      if (!isCorrect) failureReason = validation.message;
    } else {
      const puzzle = await Puzzle.findById(session.puzzleId);
      if (!puzzle)
        return res
          .status(404)
          .json({ success: false, message: "Puzzle missing." });

      isCorrect = JSON.stringify(userBoard) === JSON.stringify(puzzle.solution);
    }

    if (!isCorrect) {
      session.status = "COMPLETED";
      await session.save();
      return res.status(400).json({ success: false, message: failureReason });
    }

    // Calculate duration & XP for non-word games
    const endTime = new Date();
    const durationInSeconds = Math.floor(
      (endTime - new Date(session.startTime)) / 1000,
    );

    let xpEarned = session.targetSequence
      ? session.targetSequence.length * 15
      : 50;

    if (clientTimeElapsed && clientTimeElapsed < 10) xpEarned += 25;

    session.status = "COMPLETED";
    session.endTime = endTime;
    session.durationInSeconds = durationInSeconds;
    session.xpEarned = xpEarned;
    await session.save();

    const user = await User.findById(userId);
    if (user) {
      await updateDailyStreak(user);

      user.xp = (user.xp || 0) + xpEarned;

      if (!user.gameElo) user.gameElo = {};
      const eloKey = session.gameId === "memory" ? "memory" : "shikaku";
      user.gameElo[eloKey] = (user.gameElo?.[eloKey] || 1200) + 12;
      user.globalElo = (user.globalElo || 1200) + 8;

      await user.save();
    }

    return res.status(200).json({
      success: true,
      isCorrect: true,
      message: "PATTERN RECALLED PERFECTLY!",
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

const computeWordleFeedback = (guess, target) => {
  const length = target.length;
  const feedback = new Array(length).fill("absent");
  const targetChars = target.split("");
  const used = new Array(length).fill(false);

  // Pass 1: Exact matches (Green)
  for (let i = 0; i < length; i++) {
    if (guess[i] === targetChars[i]) {
      feedback[i] = "correct";
      used[i] = true;
    }
  }
  // Pass 2: Partial matches (Yellow)
  for (let i = 0; i < length; i++) {
    if (feedback[i] === "correct") continue;
    const foundIdx = targetChars.findIndex(
      (char, idx) => char === guess[i] && !used[idx],
    );
    if (foundIdx !== -1) {
      feedback[i] = "present";
      used[foundIdx] = true;
    }
  }
  return feedback;
};
