import dns from "dns";
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

// Helper to convert char arrays to ASCII numbers for strict [[Number]] schemas
const wordToAsciiGrid = (words) => {
  return words.map((word) =>
    word.split("").map((char) => char.toUpperCase().charCodeAt(0))
  );
};

const seedWordGame = async () => {
  try {
    console.log(`Connecting to database...`);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully!");

    // 1. Seed Word Game Metadata
    await Game.updateOne(
      { gameId: "wordGame" },
      {
        gameId: "wordGame",
        title: "LexiMatch 1v1",
        description: "Guess the target word in as few attempts as possible.",
        isActive: true,
        modes: [
          { modeId: "4-LETTER", gridSize: 4, baseXp: 40 },
          { modeId: "5-LETTER", gridSize: 5, baseXp: 60 },
          { modeId: "6-LETTER", gridSize: 6, baseXp: 80 },
        ],
      },
      { upsert: true }
    );

    // 2. Word Game Puzzles converted to Numeric ASCII matrices
    const sampleWordPuzzles = [
      // 4-Letter Words
      {
        gameId: "wordGame",
        difficulty: "EASY",
        gridSize: 4,
        board: wordToAsciiGrid(["CODE", "BYTE", "NODE", "DATA"]),
        solution: wordToAsciiGrid(["CODE"]),
      },
      {
        gameId: "wordGame",
        difficulty: "EASY",
        gridSize: 4,
        board: wordToAsciiGrid(["LOOP", "APIS", "JAVA", "HASH"]),
        solution: wordToAsciiGrid(["LOOP"]),
      },
      // 5-Letter Words
      {
        gameId: "wordGame",
        difficulty: "MEDIUM",
        gridSize: 5,
        board: wordToAsciiGrid(["REACT", "MONGO", "STACK", "SWIFT", "QUERY"]),
        solution: wordToAsciiGrid(["REACT"]),
      },
      // 6-Letter Words
      {
        gameId: "wordGame",
        difficulty: "HARD",
        gridSize: 6,
        board: wordToAsciiGrid(["NEURAL", "CYBERS", "ROUTER", "ASYNCS", "SERVERS", "PATTER"]),
        solution: wordToAsciiGrid(["NEURAL"]),
      },
    ];

    await Puzzle.deleteMany({ gameId: "wordGame" });
    await Puzzle.insertMany(sampleWordPuzzles);

    console.log("Successfully seeded Word Game metadata and ASCII puzzles!");
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedWordGame();