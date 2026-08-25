import mongoose from 'mongoose';

const gameSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: String, required: true },
    puzzleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Puzzle' },
    status: {
      type: String,
      enum: ['IN_PROGRESS', 'COMPLETED', 'ABANDONED'],
      default: 'IN_PROGRESS',
    },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date },
    durationInSeconds: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const GameSession = mongoose.model('GameSession', gameSessionSchema);