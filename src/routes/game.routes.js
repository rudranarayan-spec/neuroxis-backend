import express from 'express';
import { startGame, getPuzzle, submitGame } from '../controllers/gameController.js';
import { protect } from '../middleware/auth.js'; 

const router = express.Router();

router.get('/:gameId/puzzles', protect, getPuzzle);
router.post('/start', protect, startGame);
router.post('/submit', protect, submitGame);

export default router;