import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import leaderboardRoutes from './leaderboard.routes.js';
import matchRoutes from './matchRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/leaderboard', leaderboardRoutes);
router.use('/matches', matchRoutes);

export default router;