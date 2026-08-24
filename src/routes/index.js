import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import matchRoutes from './match.routes.js';
import matchmakingRoutes from './matchmaking.routes.js';
import userRoutes from './user.routes.js';
import gameRoutes from './game.routes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/matches', matchRoutes);
router.use('/matchmaking', matchmakingRoutes);
router.use('/game', gameRoutes);

export default router;