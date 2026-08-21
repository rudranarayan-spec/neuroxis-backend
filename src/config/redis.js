import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => console.log('[NEUROXIS Redis] Connected to Redis Cluster'));
redis.on('error', (err) => console.error('[NEUROXIS Redis Error]', err));