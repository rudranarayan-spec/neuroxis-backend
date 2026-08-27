import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import Redis from 'ioredis';

// Guarantee .env is loaded before Redis instantiates
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn('[NEUROXIS Redis Warning] REDIS_URL is not set in environment variables! Falling back to localhost.');
}

export const redis = new Redis(redisUrl || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  // Enables TLS for cloud providers like Upstash or Redis Enterprise if using rediss://
  tls: redisUrl && redisUrl.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
});

redis.on('connect', () => console.log('[NEUROXIS Redis] Connected to Redis Cloud'));
redis.on('error', (err) => console.error('[NEUROXIS Redis Error]', err.message));