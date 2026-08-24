import { randomBytes } from 'node:crypto';
import { redis } from '../config/redis.js';
import { User } from '../models/User.js';
import { leaderboardService } from './leaderboardService.js';

const ROOM_KEY_PREFIX = 'game:room:';
const TELEMETRY_KEY_PREFIX = 'game:telemetry:';

/**
 * Standard Elo Calculation Helper
 */
const calculateEloChange = (ratingA, ratingB, scoreA, K = 32) => {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const newRatingA = Math.round(ratingA + K * (scoreA - expectedA));
  return newRatingA - ratingA;
};

export const gameService = {
  /**
   * 1. Generate Deterministic Game Room & Puzzle Seed
   */
  async createGameRoom(playerAId, playerBId, gameCategory = 'quickMath') {
    const roomId = `room_${randomBytes(8).toString('hex')}`;
    const puzzleSeed = `seed_${randomBytes(6).toString('hex')}`;

    const [userA, userB] = await Promise.all([
      User.findById(playerAId).select('username globalElo gameElo region district'),
      User.findById(playerBId).select('username globalElo gameElo region district'),
    ]);

    if (!userA || !userB) throw new Error('One or both players not found');

    const eloA = userA.gameElo?.[gameCategory] || userA.globalElo || 1200;
    const eloB = userB.gameElo?.[gameCategory] || userB.globalElo || 1200;

    const roomData = {
      roomId,
      gameCategory,
      puzzleSeed,
      playerA: { id: playerAId.toString(), username: userA.username, elo: eloA, score: 0, completed: false },
      playerB: { id: playerBId.toString(), username: userB.username, elo: eloB, score: 0, completed: false },
      status: 'IN_PROGRESS',
      createdAt: Date.now(),
    };

    await redis.set(`${ROOM_KEY_PREFIX}${roomId}`, JSON.stringify(roomData), 'EX', 900); // 15 mins TTL
    return roomData;
  },

  /**
   * 2. Submit Move / Round Telemetry
   */
  async submitTelemetry(roomId, userId, telemetryPayload) {
    const roomKey = `${ROOM_KEY_PREFIX}${roomId}`;
    const roomRaw = await redis.get(roomKey);

    if (!roomRaw) throw new Error('Game room not found or expired');

    const room = JSON.parse(roomRaw);
    if (room.status === 'FINISHED') throw new Error('Game has already finished');

    const telemetryKey = `${TELEMETRY_KEY_PREFIX}${roomId}:${userId}`;
    const timestamp = Date.now();

    const telemetryEntry = {
      userId,
      moveIndex: telemetryPayload.moveIndex,
      action: telemetryPayload.action,
      scoreDelta: telemetryPayload.scoreDelta || 0,
      timestamp,
    };

    // Store raw telemetry event in Redis List
    await redis.rpush(telemetryKey, JSON.stringify(telemetryEntry));
    await redis.expire(telemetryKey, 900);

    return { roomId, userId, receivedAt: timestamp };
  },

  /**
   * 3. Finish Match & Settle Elo Results
   */
  async settleMatch(roomId, userId, finalScore, durationMs) {
    const roomKey = `${ROOM_KEY_PREFIX}${roomId}`;
    const roomRaw = await redis.get(roomKey);

    if (!roomRaw) throw new Error('Game room not found or expired');

    const room = JSON.parse(roomRaw);
    const isPlayerA = room.playerA.id === userId.toString();
    const isPlayerB = room.playerB.id === userId.toString();

    if (!isPlayerA && !isPlayerB) throw new Error('User does not belong to this game room');

    // Update player score & completion status
    if (isPlayerA) {
      room.playerA.score = finalScore;
      room.playerA.completed = true;
      room.playerA.durationMs = durationMs;
    } else {
      room.playerB.score = finalScore;
      room.playerB.completed = true;
      room.playerB.durationMs = durationMs;
    }

    // If both players have finished (or bot match)
    if ((room.playerA.completed && room.playerB.completed) || room.playerB.id === 'bot_id') {
      room.status = 'FINISHED';

      const scoreA = room.playerA.score;
      const scoreB = room.playerB.score;

      let resultA = 0.5; // Draw
      if (scoreA > scoreB) resultA = 1;
      else if (scoreA < scoreB) resultA = 0;

      const eloChangeA = calculateEloChange(room.playerA.elo, room.playerB.elo, resultA);
      const eloChangeB = -eloChangeA;

      // Update Database & Redis ZSET Ranks for Player A
      await this.applyMatchResult(room.playerA.id, resultA === 1, resultA === 0.5, eloChangeA, room.gameCategory);

      // Update Database & Redis ZSET Ranks for Player B (if human)
      if (room.playerB.id !== 'bot_id') {
        await this.applyMatchResult(room.playerB.id, resultA === 0, resultA === 0.5, eloChangeB, room.gameCategory);
      }

      room.settlement = {
        winnerId: resultA === 1 ? room.playerA.id : resultA === 0 ? room.playerB.id : null,
        playerAEloDelta: eloChangeA,
        playerBEloDelta: eloChangeB,
      };
    }

    await redis.set(roomKey, JSON.stringify(room), 'EX', 900);
    return room;
  },

  /**
   * Helper: Apply Elo & Sync Leaderboards
   */
  async applyMatchResult(userId, isWin, isDraw, eloChange, gameCategory) {
    const user = await User.findById(userId);
    if (!user) return;

    user.globalElo = Math.max(0, (user.globalElo || 1200) + eloChange);
    if (!user.gameElo) user.gameElo = {};
    user.gameElo[gameCategory] = Math.max(0, (user.gameElo[gameCategory] || 1200) + eloChange);

    user.stats = user.stats || {};
    user.stats.matchesPlayed = (user.stats.matchesPlayed || 0) + 1;

    if (isWin) {
      user.stats.wins = (user.stats.wins || 0) + 1;
      user.streak = (user.streak || 0) + 1;
      user.stats.highestStreak = Math.max(user.stats.highestStreak || 0, user.streak);
    } else if (!isDraw) {
      user.stats.losses = (user.stats.losses || 0) + 1;
      user.streak = 0;
    }

    await user.save();

    // Sync updated score to Redis Leaderboard ZSETs
    await leaderboardService.updateUserRank(userId, user.globalElo, user.region, user.district);
  },
};