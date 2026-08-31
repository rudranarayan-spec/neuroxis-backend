import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { getPendingRequests, respondToRequest, sendFriendRequest, getFriends, removeFriend } from '../controllers/friendController.js';

const router = Router();

router.post('/send-request', protect, sendFriendRequest);
router.post('/respond-request', protect, respondToRequest);
router.get('/list', protect, getFriends);
router.get('/requests', protect, getPendingRequests);
router.delete('/remove/:friendId', protect, removeFriend);

export default router;