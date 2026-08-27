import mongoose from 'mongoose';
import dns from 'dns';
import dotenv from 'dotenv';
import { Game } from '../models/Game.js';
dns.setServers(['8.8.8.8', '8.8.4.4']);
dotenv.config();

// Default fallback URI if MONGO_URI is not in process.env
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/neuroxis';

const gamesToSeed = [
  {
    gameId: 'echoPattern',
    title: 'Echo Pattern',
    description: 'A memory pattern recall game to test cognitive agility.',
    isActive: true,
    modes: [
      { modeId: 'easy', gridSize: 3, baseXp: 50 },
      { modeId: 'medium', gridSize: 4, baseXp: 100 },
      { modeId: 'hard', gridSize: 5, baseXp: 200 },
    ],
  }
];

async function seedDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully.');

    // Prepare upsert operations matching on `gameId`
    const bulkOperations = gamesToSeed.map((game) => ({
      updateOne: {
        filter: { gameId: game.gameId },
        update: { $set: game },
        upsert: true,
      },
    }));

    const result = await Game.bulkWrite(bulkOperations);

    console.log('--- Seed Summary ---');
    console.log(`Matched documents: ${result.matchedCount}`);
    console.log(`Modified documents: ${result.modifiedCount}`);
    console.log(`Inserted (Upserted) documents: ${result.upsertedCount}`);
    console.log('Game collection successfully seeded!');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
    process.exit(0);
  }
}

seedDatabase();