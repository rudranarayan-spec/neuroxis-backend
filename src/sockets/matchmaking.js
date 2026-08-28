import { Match } from "../models/Match.js";

// In-memory queues grouped by game category
// Structure: { quickMath: [ { socketId, userId, rating }, ... ], memory: [...] }
const matchmakingQueues = {};

/**
 * Helper to log queue status clearly in terminal
 */
function logQueueState(gameCategory) {
  const queue = matchmakingQueues[gameCategory] || [];
  console.log(
    `\x1b[36m[QUEUE STATE]\x1b[0m Category: "${gameCategory}" | Total Players Waiting: ${queue.length}`
  );
  if (queue.length > 0) {
    console.log(
      `   └── Queued Users:`,
      queue.map((p) => `[User: ${p.userId} | Socket: ${p.socketId}]`).join(", ")
    );
  }
}

export function setupMatchmaking(io) {
  io.on("connection", (socket) => {
    console.log(`\x1b[32m[SOCKET CONNECTED]\x1b[0m ID: ${socket.id}`);

    // 1. Player joins matchmaking queue
    socket.on("JOIN_QUEUE", ({ userId, gameCategory }) => {
      console.log(
        `\n\x1b[33m[QUEUE JOIN ATTEMPT]\x1b[0m User: ${userId} | Category: "${gameCategory}" | Socket: ${socket.id}`
      );

      if (!gameCategory) {
        console.error(`\x1b[31m[QUEUE ERROR]\x1b[0m Missing gameCategory for User: ${userId}`);
        return;
      }

      if (!matchmakingQueues[gameCategory]) {
        matchmakingQueues[gameCategory] = [];
      }

      // Check if player is already queued (by userId or socketId)
      const existingPlayerIndex = matchmakingQueues[gameCategory].findIndex(
        (player) => player.userId === userId || player.socketId === socket.id
      );

      if (existingPlayerIndex !== -1) {
        // Refresh stale socket ID if re-joining with same userId
        matchmakingQueues[gameCategory][existingPlayerIndex].socketId = socket.id;
        console.log(`\x1b[35m[QUEUE REFRESH]\x1b[0m Updated stale socket for User: ${userId}`);
      } else {
        matchmakingQueues[gameCategory].push({ socketId: socket.id, userId });
        socket.join(`queue_${gameCategory}`);
        console.log(`\x1b[32m[QUEUE SUCCESS]\x1b[0m User: ${userId} added to "${gameCategory}"`);
      }

      logQueueState(gameCategory);

      // 2. Check if we have at least 2 players to form a match
      if (matchmakingQueues[gameCategory].length >= 2) {
        const player1 = matchmakingQueues[gameCategory].shift();
        const player2 = matchmakingQueues[gameCategory].shift();

        const roomId = `room_${player1.userId}_${player2.userId}_${Date.now()}`;
        const puzzleSeed = `seed_${Math.random().toString(36).substring(7)}`;

        const socket1 = io.sockets.sockets.get(player1.socketId);
        const socket2 = io.sockets.sockets.get(player2.socketId);

        console.log(`\n\x1b[35m[MATCH FOUND]\x1b[0m Creating match for Category: "${gameCategory}"`);
        console.log(`   ├── Player A: ${player1.userId} (Socket: ${player1.socketId})`);
        console.log(`   ├── Player B: ${player2.userId} (Socket: ${player2.socketId})`);
        console.log(`   └── Room ID: ${roomId} | Seed: ${puzzleSeed}`);

        if (socket1 && socket2) {
          socket1.join(roomId);
          socket2.join(roomId);

          const payload = {
            roomId,
            gameCategory,
            puzzleSeed,
            playerA: player1.userId,
            playerB: player2.userId,
          };

          // Emit start payload to both opponents
          io.to(roomId).emit("MATCH_START", payload);
          console.log(`\x1b[32m[MATCH EMITTED]\x1b[0m Payload sent to room: ${roomId}`);
        } else {
          console.error(
            `\x1b[31m[MATCH FAILED]\x1b[0m One or both sockets disconnected before match setup.`
          );
          if (!socket1) console.error(`   └── Missing Socket for User: ${player1.userId}`);
          if (!socket2) console.error(`   └── Missing Socket for User: ${player2.userId}`);
        }

        logQueueState(gameCategory);
      }
    });

    // 3. Real-time Score Sync
    socket.on("SCORE_UPDATE", ({ roomId, userId, currentScore }) => {
      console.log(
        `\x1b[34m[SCORE UPDATE]\x1b[0m Room: ${roomId} | User: ${userId} | Score: ${currentScore}`
      );

      if (!socket.rooms.has(roomId)) {
        console.log(`\x1b[33m[ROOM RE-JOIN]\x1b[0m Re-adding Socket: ${socket.id} to Room: ${roomId}`);
        socket.join(roomId);
      }
      
      socket.to(roomId).emit("OPPONENT_SCORE_UPDATE", { userId, currentScore });
    });

    // 4. Submit Match Results
    socket.on("SUBMIT_MATCH", async (matchData) => {
      console.log(`\n\x1b[33m[MATCH SUBMIT RECEIVED]\x1b[0m Room: ${matchData?.roomId}`);
      try {
        const {
          roomId,
          playerA,
          playerB,
          scoreA,
          scoreB,
          durationMs,
          puzzleSeed,
          gameCategory,
          moveLog,
        } = matchData;

        let winner = null;
        let isDraw = false;

        if (scoreA > scoreB) winner = playerA;
        else if (scoreB > scoreA) winner = playerB;
        else isDraw = true;

        console.log(`   ├── Outcome: ${isDraw ? "DRAW" : `WINNER -> ${winner}`}`);
        console.log(`   └── Scores -> Player A (${playerA}): ${scoreA} | Player B (${playerB}): ${scoreB}`);

        // Persist match in MongoDB
        const newMatch = await Match.create({
          gameCategory,
          mode: "DUEL_1V1",
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

        console.log(`\x1b[32m[DB SAVE SUCCESS]\x1b[0m Match Doc ID: ${newMatch._id}`);

        io.to(roomId).emit("MATCH_OVER", { match: newMatch });
        console.log(`\x1b[32m[MATCH OVER EMITTED]\x1b[0m Broadcasted to Room: ${roomId}`);
      } catch (error) {
        console.error("\x1b[31m[DB SAVE ERROR]\x1b[0m Error saving match:", error);
      }
    });

    // 5. Leave Queue or Disconnect Handling
    socket.on("LEAVE_QUEUE", ({ userId, gameCategory }) => {
      console.log(
        `\n\x1b[31m[QUEUE LEAVE]\x1b[0m User: ${userId} explicitly left Category: "${gameCategory}"`
      );
      if (matchmakingQueues[gameCategory]) {
        matchmakingQueues[gameCategory] = matchmakingQueues[
          gameCategory
        ].filter((player) => player.userId !== userId);
      }
      logQueueState(gameCategory);
    });

    socket.on("disconnect", (reason) => {
      console.log(`\n\x1b[31m[SOCKET DISCONNECTED]\x1b[0m ID: ${socket.id} | Reason: ${reason}`);

      // Cleanup queues on drop
      Object.keys(matchmakingQueues).forEach((cat) => {
        const initialLength = matchmakingQueues[cat].length;
        matchmakingQueues[cat] = matchmakingQueues[cat].filter(
          (player) => player.socketId !== socket.id
        );
        
        if (matchmakingQueues[cat].length !== initialLength) {
          console.log(`\x1b[33m[QUEUE CLEANUP]\x1b[0m Removed dropped socket ${socket.id} from "${cat}"`);
          logQueueState(cat);
        }
      });
    });
  });
}