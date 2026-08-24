import { randomBytes } from 'node:crypto';
import { redis } from '../config/redis.js';
import { User } from '../models/User.js';

const QUEUE_KEY_PREFIX = 'matchmaking:queue:';
const TICKET_KEY_PREFIX = 'matchmaking:ticket:';
const ROOM_KEY_PREFIX = 'game:room:';
const PRIVATE_ROOM_PREFIX = 'game:private:';

export const matchmakingService = {
  /**
   * 1. Join Public Matchmaking Queue
   */
  async joinQueue(userId, gameCategory = 'quickMath') {
    if (!redis.status || redis.status !== 'ready') {
      await redis.connect();
    }

    const user = await User.findById(userId).select('username globalElo gameElo');
    if (!user) throw new Error('User not found');

    const playerElo = user.gameElo[gameCategory] || user.globalElo || 1200;
    const queueKey = `${QUEUE_KEY_PREFIX}${gameCategory}`;
    const ticketKey = `${TICKET_KEY_PREFIX}${userId}`;

    // Check if user is already in queue or room
    const existingTicket = await redis.get(ticketKey);
    if (existingTicket) {
      const parsed = JSON.parse(existingTicket);
      if (parsed.status === 'MATCHED') return parsed;
    }

    const ticketData = {
      userId,
      username: user.username,
      gameCategory,
      elo: playerElo,
      joinedAt: Date.now(),
      status: 'SEARCHING',
      roomId: null,
    };

    const pipeline = redis.pipeline();
    // Add user to Redis ZSET (Score = Elo, Member = userId)
    pipeline.zadd(queueKey, playerElo, userId);
    // Store ticket metadata with 2-minute TTL
    pipeline.set(ticketKey, JSON.stringify(ticketData), 'EX', 120);
    await pipeline.exec();

    // Trigger instant match check
    const matchResult = await this.findMatch(userId, gameCategory, playerElo);
    if (matchResult) return matchResult;

    return ticketData;
  },

  /**
   * 2. Find Opponent using Expanding Search Radius
   */
  async findMatch(userId, gameCategory, playerElo) {
    const queueKey = `${QUEUE_KEY_PREFIX}${gameCategory}`;
    const ticketKey = `${TICKET_KEY_PREFIX}${userId}`;

    const ticketRaw = await redis.get(ticketKey);
    if (!ticketRaw) return null;
    const ticket = JSON.parse(ticketRaw);

    if (ticket.status === 'MATCHED') return ticket;

    const timeInQueueMs = Date.now() - ticket.joinedAt;

    // Expanding Elo range calculation based on wait time
    let eloRange = 50;
    if (timeInQueueMs > 10000) eloRange = 250;
    else if (timeInQueueMs > 5000) eloRange = 100;

    const minElo = Math.max(0, playerElo - eloRange);
    const maxElo = playerElo + eloRange;

    // Fetch candidate opponents within Elo range
    const candidates = await redis.zrangebyscore(queueKey, minElo, maxElo);

    // Filter out self
    const opponentId = candidates.find((id) => id !== userId.toString());

    if (!opponentId) {
      // If waiting > 15s, flag for Bot fallback
      if (timeInQueueMs > 15000) {
        return await this.createBotMatch(userId, gameCategory, playerElo);
      }
      return null;
    }

    // Attempt Atomic Lock & Removal for both players
    const multi = redis.multi();
    multi.zrem(queueKey, userId);
    multi.zrem(queueKey, opponentId);
    const results = await multi.exec();

    // If either player was removed by another process, abort
    if (results[0][1] !== 1 || results[1][1] !== 1) {
      return null;
    }

    // Fetch Opponent Profile
    const opponent = await User.findById(opponentId).select('username');

    // Create Game Room
    const roomId = `room_${randomBytes(8).toString('hex')}`;
    const puzzleSeed = `seed_${randomBytes(6).toString('hex')}`;

    const roomData = {
      roomId,
      gameCategory,
      puzzleSeed,
      playerA: { id: userId, username: ticket.username, elo: playerElo },
      playerB: { id: opponentId, username: opponent.username, elo: playerElo },
      status: 'ACTIVE',
      createdAt: Date.now(),
    };

    // Save Room State (TTL 10 mins)
    await redis.set(`${ROOM_KEY_PREFIX}${roomId}`, JSON.stringify(roomData), 'EX', 600);

    // Update tickets for both players
    const matchedPayload = {
      status: 'MATCHED',
      roomId,
      puzzleSeed,
      opponent: { id: opponentId, username: opponent.username },
    };

    await redis.set(`${TICKET_KEY_PREFIX}${userId}`, JSON.stringify({ ...ticket, ...matchedPayload }), 'EX', 300);
    await redis.set(`${TICKET_KEY_PREFIX}${opponentId}`, JSON.stringify({ status: 'MATCHED', ...matchedPayload }), 'EX', 300);

    return matchedPayload;
  },

  /**
   * 3. Bot Fallback Match Generator
   */
  async createBotMatch(userId, gameCategory, playerElo) {
    const queueKey = `${QUEUE_KEY_PREFIX}${gameCategory}`;
    const ticketKey = `${TICKET_KEY_PREFIX}${userId}`;

    await redis.zrem(queueKey, userId);

    const roomId = `room_bot_${randomBytes(8).toString('hex')}`;
    const puzzleSeed = `seed_${randomBytes(6).toString('hex')}`;
    const botNames = ['NeuroBot_V1', 'CypherAI', 'LogicMaster', 'ApexMind'];
    const botUsername = botNames[Math.floor(Math.random() * botNames.length)];

    const matchedPayload = {
      status: 'MATCHED',
      roomId,
      puzzleSeed,
      isBot: true,
      opponent: { id: 'bot_id', username: botUsername, elo: playerElo },
    };

    await redis.set(`${TICKET_KEY_PREFIX}${userId}`, JSON.stringify(matchedPayload), 'EX', 300);
    return matchedPayload;
  },

  /**
   * 4. Poll Matchmaking Status
   */
  async getQueueStatus(userId) {
    const ticketKey = `${TICKET_KEY_PREFIX}${userId}`;
    const ticketRaw = await redis.get(ticketKey);

    if (!ticketRaw) return { status: 'IDLE' };

    const ticket = JSON.parse(ticketRaw);
    if (ticket.status === 'SEARCHING') {
      // Re-trigger search during polling
      const match = await this.findMatch(userId, ticket.gameCategory, ticket.elo);
      if (match) return match;
    }

    return ticket;
  },

  /**
   * 5. Cancel Queue
   */
  async leaveQueue(userId, gameCategory) {
    const queueKey = `${QUEUE_KEY_PREFIX}${gameCategory}`;
    const ticketKey = `${TICKET_KEY_PREFIX}${userId}`;

    await redis.zrem(queueKey, userId);
    await redis.del(ticketKey);
    return true;
  },

  /**
   * 6. Create Private Friend Room
   */
  async createPrivateRoom(userId, gameCategory) {
    const roomCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
    const puzzleSeed = `seed_${randomBytes(6).toString('hex')}`;

    const user = await User.findById(userId).select('username');

    const privateRoomData = {
      roomCode,
      gameCategory,
      puzzleSeed,
      host: { id: userId, username: user.username },
      guest: null,
      status: 'WAITING',
    };

    await redis.set(`${PRIVATE_ROOM_PREFIX}${roomCode}`, JSON.stringify(privateRoomData), 'EX', 600);
    return privateRoomData;
  },

  /**
   * 7. Join Private Friend Room by Code
   */
  async joinPrivateRoom(userId, roomCode) {
    const roomKey = `${PRIVATE_ROOM_PREFIX}${roomCode}`;
    const roomRaw = await redis.get(roomKey);

    if (!roomRaw) throw new Error('Invalid or expired room code');

    const room = JSON.parse(roomRaw);
    if (room.status !== 'WAITING') throw new Error('Room is already full or in progress');

    const user = await User.findById(userId).select('username');

    room.guest = { id: userId, username: user.username };
    room.status = 'READY';

    await redis.set(roomKey, JSON.stringify(room), 'EX', 600);
    return room;
  },
};