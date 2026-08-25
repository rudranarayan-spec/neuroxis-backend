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

const seedSudoku = async () => {
  try {
    console.log(`Connecting to database...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    // 1. Seed Sudoku Game Metadata
    await Game.updateOne(
      { gameId: "sudoku" },
      {
        gameId: "sudoku",
        title: "Matrix Sudoku",
        description: "Decrypt the grid sequence under time pressure.",
        isActive: true,
        modes: [
          { modeId: "6x6", gridSize: 6, baseXp: 50 },
          { modeId: "9x9", gridSize: 9, baseXp: 120 },
        ],
      },
      { upsert: true },
    );

    // 2. Seed Sample 6x6 Sudoku Puzzle
    const sample6x6Puzzles = [
      // Puzzle 1: Easy
      {
        gameId: "sudoku",
        difficulty: "EASY",
        gridSize: 6,
        board: [
          [0, 0, 3, 0, 1, 0],
          [5, 6, 0, 3, 2, 0],
          [0, 5, 4, 2, 0, 3],
          [2, 0, 6, 4, 5, 0],
          [0, 1, 2, 0, 4, 5],
          [0, 4, 0, 1, 0, 0],
        ],
        solution: [
          [4, 2, 3, 5, 1, 6],
          [5, 6, 1, 3, 2, 4],
          [1, 5, 4, 2, 6, 3],
          [2, 3, 6, 4, 5, 1],
          [3, 1, 2, 6, 4, 5],
          [6, 4, 5, 1, 3, 2],
        ],
      },
      // Puzzle 2: Medium
      {
        gameId: "sudoku",
        difficulty: "MEDIUM",
        gridSize: 6,
        board: [
          [0, 2, 0, 6, 0, 0],
          [0, 0, 0, 0, 5, 0],
          [2, 0, 1, 0, 0, 6],
          [4, 0, 0, 5, 0, 2],
          [0, 4, 0, 0, 0, 0],
          [0, 0, 6, 0, 4, 0],
        ],
        solution: [
          [5, 2, 4, 6, 3, 1],
          [6, 1, 3, 4, 5, 2],
          [2, 5, 1, 3, 8, 6],
          [4, 3, 8, 5, 1, 2],
          [1, 4, 5, 2, 6, 3],
          [3, 8, 6, 1, 4, 5],
        ],
      },
      // Puzzle 3: Hard
      {
        gameId: "sudoku",
        difficulty: "HARD",
        gridSize: 6,
        board: [
          [0, 0, 0, 0, 0, 4],
          [0, 5, 0, 2, 0, 0],
          [0, 0, 6, 0, 3, 0],
          [0, 1, 0, 5, 0, 0],
          [0, 0, 3, 0, 2, 0],
          [6, 0, 0, 0, 0, 0],
        ],
        solution: [
          [2, 3, 1, 6, 5, 4],
          [4, 5, 6, 2, 1, 3],
          [5, 4, 6, 1, 3, 2],
          [3, 1, 2, 5, 4, 6],
          [1, 6, 3, 4, 2, 5],
          [6, 2, 5, 3, 6, 1],
        ],
      },
    ];

    await Puzzle.deleteMany({ gameId: "sudoku", gridSize: 6 });
    await Puzzle.insertMany(sample6x6Puzzles);

    console.log("Successfully seeded Sudoku game meta and 6x6 puzzle!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedSudoku();
