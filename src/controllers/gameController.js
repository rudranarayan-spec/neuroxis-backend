import { gameService } from '../services/gameService.js';

export const createRoom = async (req, res) => {
  try {
    const playerAId = req.user.id;
    const { opponentId, gameCategory = 'quickMath' } = req.body;

    if (!opponentId) {
      return res.status(400).json({ success: false, error: 'Opponent ID is required' });
    }

    const room = await gameService.createGameRoom(playerAId, opponentId, gameCategory);
    res.status(201).json({ success: true, room });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const submitMoveTelemetry = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId, moveIndex, action, scoreDelta } = req.body;

    if (!roomId || moveIndex === undefined || !action) {
      return res.status(400).json({ success: false, error: 'Missing required telemetry fields' });
    }

    const result = await gameService.submitTelemetry(roomId, userId, { moveIndex, action, scoreDelta });
    res.status(200).json({ success: true, telemetry: result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const settleGameResult = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId, finalScore, durationMs } = req.body;

    if (!roomId || finalScore === undefined) {
      return res.status(400).json({ success: false, error: 'Room ID and final score are required' });
    }

    const settledRoom = await gameService.settleMatch(roomId, userId, Number(finalScore), Number(durationMs || 0));
    res.status(200).json({ success: true, room: settledRoom });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};