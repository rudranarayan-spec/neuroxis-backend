import { Router } from 'express';
import { submitMatch, getMatchHistory } from '../controllers/matchController.js';
import { protect } from '../middleware/auth.js';

const router = Router();

router.post('/submit', protect, submitMatch);
router.get('/history', protect, getMatchHistory);

export default router;