import dns from "dns";
// Force Node to use Google Public DNS for SRV lookup
dns.setServers(["8.8.8.8", "8.8.4.4"]);

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

import { Game } from "../models/Game.js";
import { Puzzle } from "../models/Puzzle.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
  console.error("CRITICAL: MONGO_URI environment variable is missing.");
  process.exit(1);
}

const seedShikaku = async () => {
  try {
    console.log(`Connecting to database...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    // 1. Seed Shikaku Game Metadata
    await Game.updateOne(
      { gameId: "shikaku" },
      {
        gameId: "shikaku",
        title: "Shikaku Rectangles",
        description:
          "Divide the grid into rectangular zones matching target areas.",
        isActive: true,
        modes: [
          { modeId: "5x5", gridSize: 5, baseXp: 40 },
          { modeId: "7x7", gridSize: 7, baseXp: 80 },
        ],
      },
      { upsert: true },
    );

    // 2. Seed Sample 5x5 Shikaku Puzzles
    const sample5x5Puzzles = [
      // Puzzle 1: Easy (4x4)
      {
        gameId: "shikaku",
        difficulty: "EASY",
        gridSize: 4,
        board: [
          [0, 0, 3, 0],
          [0, 3, 0, 0],
          [0, 0, 0, 4],
          [3, 0, 3, 0],
        ],
        solution: [
          [2, 2, 2, 1],
          [4, 5, 3, 1],
          [4, 5, 3, 1],
          [4, 5, 3, 1],
        ],
      },
      // Puzzle 2: Easy (5x5)
      {
        gameId: "shikaku",
        difficulty: "EASY",
        gridSize: 5,
        board: [
          [2, 0, 0, 6, 5],
          [0, 0, 0, 0, 0],
          [0, 4, 0, 0, 0],
          [4, 0, 0, 4, 0],
          [0, 0, 0, 0, 0],
        ],
        solution: [
          [5, 5, 3, 3, 1],
          [6, 6, 3, 3, 1],
          [6, 6, 3, 3, 1],
          [2, 2, 4, 4, 1],
          [2, 2, 4, 4, 1],
        ],
      },
      // ...5 more (Easy 5x5, Medium 5x5, Hard 5x5, Medium 6x6, Hard 6x6) — full set in the file
    ];

    await Puzzle.deleteMany({ gameId: "shikaku", gridSize: 5 });
    await Puzzle.insertMany(sample5x5Puzzles);

    console.log("Successfully seeded Shikaku game meta and 5x5 puzzles!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedShikaku();
