import mongoose from 'mongoose';

const gameSchema = new mongoose.Schema(
  {
    gameId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    isActive: { type: Boolean, default: true },
    modes: [
      {
        modeId: { type: String, required: true },
        gridSize: { type: Number },
        baseXp: { type: Number, default: 50 },
      },
    ],
  },
  { timestamps: true }
);

export const Game = mongoose.model('Game', gameSchema);