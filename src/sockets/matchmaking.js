import { Match } from '../models/Match.js';

// In-memory queues grouped by game category
// Structure: { quickMath: [ { socketId, userId, rating }, ... ], memory: [...] }
const matchmakingQueues = {};

export function setupMatchmaking(io) {
  io.on('connection', (socket) => {
    
    // 1. Player joins matchmaking queue
    socket.on('JOIN_QUEUE', ({ userId, gameCategory }) => {
      if (!matchmakingQueues[gameCategory]) {
        matchmakingQueues[gameCategory] = [];
      }

      // Check if player is already queued
      const alreadyInQueue = matchmakingQueues[gameCategory].some(
        (player) => player.userId === userId
      );

      if (!alreadyInQueue) {
        matchmakingQueues[gameCategory].push({ socketId: socket.id, userId });
        socket.join(`queue_${gameCategory}`);
      }

      // 2. Check if we have at least 2 players to form a match
      if (matchmakingQueues[gameCategory].length >= 2) {
        const player1 = matchmakingQueues[gameCategory].shift();
        const player2 = matchmakingQueues[gameCategory].shift();

        const roomId = `room_${player1.userId}_${player2.userId}_${Date.now()}`;
        const puzzleSeed = `seed_${Math.random().toString(36).substring(7)}`;

        const socket1 = io.sockets.sockets.get(player1.socketId);
        const socket2 = io.sockets.sockets.get(player2.socketId);

        if (socket1 && socket2) {
          socket1.join(roomId);
          socket2.join(roomId);

          // Emit start payload to both opponents
          io.to(roomId).emit('MATCH_START', {
            roomId,
            gameCategory,
            puzzleSeed,
            playerA: player1.userId,
            playerB: player2.userId,
          });
        }
      }
    });

    // 3. Real-time Score Sync
    socket.on('SCORE_UPDATE', ({ roomId, userId, currentScore }) => {
      socket.to(roomId).emit('OPPONENT_SCORE_UPDATE', { userId, currentScore });
    });

    // 4. Submit Match Results
    socket.on('SUBMIT_MATCH', async (matchData) => {
      try {
        const { roomId, playerA, playerB, scoreA, scoreB, durationMs, puzzleSeed, gameCategory, moveLog } = matchData;

        let winner = null;
        let isDraw = false;

        if (scoreA > scoreB) winner = playerA;
        else if (scoreB > scoreA) winner = playerB;
        else isDraw = true;

        // Persist match in MongoDB
        const newMatch = await Match.create({
          gameCategory,
          mode: 'DUEL_1V1',
          playerA,
          playerB,
          scoreA,
          scoreB,
          winner,
          isDraw,
          durationMs,
          puzzleSeed,
          moveLog,
        });

        io.to(roomId).emit('MATCH_OVER', { match: newMatch });
      } catch (error) {
        console.error('Error saving match:', error);
      }
    });

    // 5. Leave Queue or Disconnect Handling
    socket.on('LEAVE_QUEUE', ({ userId, gameCategory }) => {
      if (matchmakingQueues[gameCategory]) {
        matchmakingQueues[gameCategory] = matchmakingQueues[gameCategory].filter(
          (player) => player.userId !== userId
        );
      }
    });

    socket.on('disconnect', () => {
      // Cleanup queues on drop
      Object.keys(matchmakingQueues).forEach((cat) => {
        matchmakingQueues[cat] = matchmakingQueues[cat].filter(
          (player) => player.socketId !== socket.id
        );
      });
    });
  });
}