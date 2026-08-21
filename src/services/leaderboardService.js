import { redis } from '../config/redis.js';

export class LeaderboardService {
  static async submitScore(userId, username, score, gameType, region = 'GLOBAL') {
    const globalKey = `neuroxis:leaderboard:${gameType}:global`;
    const regionKey = `neuroxis:leaderboard:${gameType}:${region.toUpperCase()}`;

    const memberData = JSON.stringify({ userId, username });

    // Atomic update to both global and regional Redis Sorted Sets
    const pipeline = redis.pipeline();
    pipeline.zadd(globalKey, 'GT', score, memberData); // 'GT': Only update if new score is Greater Than old score
    pipeline.zadd(regionKey, 'GT', score, memberData);
    await pipeline.exec();
  }

  static async getTopRankings(gameType, region = 'GLOBAL', limit = 50) {
    const key = region === 'GLOBAL' 
      ? `neuroxis:leaderboard:${gameType}:global`
      : `neuroxis:leaderboard:${gameType}:${region.toUpperCase()}`;

    // Get members and scores sorted highest to lowest
    const rawData = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');
    
    const rankings = [];
    for (let i = 0; i < rawData.length; i += 2) {
      const playerInfo = JSON.parse(rawData[i]);
      rankings.push({
        rank: i / 2 + 1,
        userId: playerInfo.userId,
        username: playerInfo.username,
        score: parseFloat(rawData[i + 1]),
      });
    }

    return rankings;
  }
}