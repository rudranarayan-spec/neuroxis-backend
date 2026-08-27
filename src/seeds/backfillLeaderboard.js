import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { leaderboardService } from '../services/leaderboardService.js';
import { redis } from '../config/redis.js';

// Force DNS lookup to use Google DNS to bypass ISP SRV block
dns.setServers(['8.8.8.8', '8.8.4.4']);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path points to root directory .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI;

async function runBackfill() {
  try {
    if (!MONGO_URI) {
      throw new Error('MONGO_URI is missing from your .env configuration.');
    }

    console.log('🔄 Connecting to MongoDB & Redis...');
    await mongoose.connect(MONGO_URI);
    
    if (redis.status !== 'ready') {
      await redis.connect();
    }

    console.log('📊 Fetching all non-banned users from MongoDB...');
    const users = await User.find({ isBanned: { $ne: true } }).lean();
    console.log(`Found ${users.length} users to sync.`);

    let count = 0;
    for (const user of users) {
      await leaderboardService.updateUserRank(user);
      count++;
      
      if (count % 100 === 0 || count === users.length) {
        console.log(`Synced ${count}/${users.length} users...`);
      }
    }

    console.log(`✅ Backfill complete! Successfully indexed ${count} users into Redis.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Backfill failed:', error.message);
    process.exit(1);
  }
}

runBackfill();