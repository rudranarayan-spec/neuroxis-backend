import { matchmakingService } from '../services/matchmakingService.js';

export const joinMatchmaking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameCategory = 'quickMath' } = req.body;

    const result = await matchmakingService.joinQueue(userId, gameCategory);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const pollMatchmakingStatus = async (req, res) => {
  try {
    const userId = req.user.id;
    const status = await matchmakingService.getQueueStatus(userId);
    res.status(200).json({ success: true, data: status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const cancelMatchmaking = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameCategory = 'quickMath' } = req.body;

    await matchmakingService.leaveQueue(userId, gameCategory);
    res.status(200).json({ success: true, message: 'Queue left successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createPrivateRoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const { gameCategory = 'quickMath' } = req.body;

    const room = await matchmakingService.createPrivateRoom(userId, gameCategory);
    res.status(201).json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const joinPrivateRoom = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomCode } = req.body;

    if (!roomCode) {
      return res.status(400).json({ success: false, error: 'Room code is required' });
    }

    const room = await matchmakingService.joinPrivateRoom(userId, roomCode);
    res.status(200).json({ success: true, room });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};