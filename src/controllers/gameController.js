import { Puzzle } from '../models/Puzzle.js';
import { GameSession } from '../models/GameSession.js';
import { User } from '../models/User.js';
import { updateDailyStreak } from '../utils/updateStreak.js';

// 1. Fetch a random puzzle board (hides solution)
export const getPuzzle = async (req, res) => {
  try {
    const { gameId } = req.params;
    const { difficulty = 'EASY', gridSize = 6 } = req.query;

    const count = await Puzzle.countDocuments({
      gameId,
      difficulty,
      gridSize: Number(gridSize),
    });

    if (count === 0) {
      return res.status(404).json({ success: false, message: 'No puzzles found for this mode.' });
    }

    const random = Math.floor(Math.random() * count);
    const puzzle = await Puzzle.findOne({
      gameId,
      difficulty,
      gridSize: Number(gridSize),
    })
      .skip(random)
      .select('-solution');

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

// 3. Submit solution, verify board, update User XP
// 3. Submit solution, verify board, update User XP & Daily Streak
export const submitGame = async (req, res) => {
  try {
    const { sessionId, userBoard, clientTimeElapsed } = req.body;
    const userId = req.user._id;

    const session = await GameSession.findById(sessionId);
    if (!session || session.status !== 'IN_PROGRESS') {
      return res.status(400).json({ success: false, message: 'Invalid or expired session.' });
    }

    const puzzle = await Puzzle.findById(session.puzzleId);
    if (!puzzle) {
      return res.status(404).json({ success: false, message: 'Puzzle template missing.' });
    }

    // Verify Board Matrix against Solution
    const isCorrect = JSON.stringify(userBoard) === JSON.stringify(puzzle.solution);

    if (!isCorrect) {
      return res.status(400).json({
        success: false,
        message: 'Solution incorrect. Review your numbers and try again.',
      });
    }

    // Calculate duration & XP
    const endTime = new Date();
    const durationInSeconds = Math.floor((endTime - new Date(session.startTime)) / 1000);

    let xpEarned = puzzle.gridSize === 6 ? 50 : 120;
    if (clientTimeElapsed < 120) xpEarned += 20;

    // Update Game Session
    session.status = 'COMPLETED';
    session.endTime = endTime;
    session.durationInSeconds = durationInSeconds;
    session.xpEarned = xpEarned;
    await session.save();

    // 1. Fetch User document to update streak
    const user = await User.findById(userId);

    if (user) {
      // 2. Trigger daily streak calculation (handles day checking & streak incrementing/saving)
      await updateDailyStreak(user);

      // 3. Increment XP and stats on the updated user document
      user.xp = (user.xp || 0) + xpEarned;
      user.stats = user.stats || {};
      user.stats.matches = (user.stats.matches || 0) + 1;
      user.stats.wins = (user.stats.wins || 0) + 1;

      await user.save();
    }

    return res.status(200).json({
      success: true,
      message: 'VICTORY! Grid decrypted.',
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
      return res.status(404).json({ message: 'Game session not found' });
    }

    if (session.status !== 'IN_PROGRESS') {
      return res.status(400).json({ 
        message: `Cannot abandon session with status: ${session.status}` 
      });
    }

    session.status = 'ABANDONED';
    session.endTime = new Date();
    if (durationInSeconds) {
      session.durationInSeconds = durationInSeconds;
    }

    await session.save();

    return res.status(200).json({
      message: 'Game session marked as abandoned successfully.',
      session,
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Failed to abandon game session', 
      error: error.message 
    });
  }
};