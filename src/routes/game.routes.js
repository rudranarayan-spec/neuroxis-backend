import express from 'express';
import { startGame, getPuzzle, submitGame, abandonGameSession } from '../controllers/gameController.js';
import { protect } from '../middleware/auth.js'; 

const router = express.Router();

router.get('/:gameId/puzzles', protect, getPuzzle);
router.post('/start', protect, startGame);
router.post('/submit', protect, submitGame);
router.patch('/session/:sessionId/abandon', abandonGameSession);

export default router;