import mongoose from 'mongoose';

const puzzleSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, index: true },
    difficulty: {
      type: String,
      enum: ['EASY', 'MEDIUM', 'HARD'],
      default: 'EASY',
    },
    gridSize: { type: Number, default: 6 },
    board: { type: [[Number]], required: true },
    solution: { type: [[Number]], required: true },
  },
  { timestamps: true }
);

export const Puzzle = mongoose.model('Puzzle', puzzleSchema);