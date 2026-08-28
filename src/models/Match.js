import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    // Category & Game Type Configuration
    gameCategory: {
      type: String,
      required: [true, 'Game category is required'],
      enum: ['quickMath', 'sudoku', 'memory', 'wordGame', 'matics', 'echoPattern', 'shikaku'],
      index: true,
    },
    mode: {
      type: String,
      required: true,
      enum: ['SOLO', 'DUEL_1V1', 'TOURNAMENT'],
      default: 'SOLO',
      index: true,
    },

    // Participants
    playerA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    playerB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Scores & Metrics
    scoreA: { type: Number, required: true, default: 0 },
    scoreB: { type: Number, default: 0 },
    
    // Outcomes
    winner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    isDraw: { type: Boolean, default: false },

    // Rating Adjustments (Auditing)
    playerAEloChange: { type: Number, default: 0 },
    playerBEloChange: { type: Number, default: 0 },

    // Anti-Cheat & Deterministic Replay Data
    durationMs: { type: Number, required: true }, // Total time spent in milliseconds
    puzzleSeed: { type: String, required: true }, // Seed used to generate client-side puzzle
    moveLog: [
      {
        timestampMs: { type: Number },
        action: { type: String },
      },
    ],
    isValidated: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Compound Index for fast lookup of a user's recent match history by game mode
matchSchema.index({ playerA: 1, gameCategory: 1, createdAt: -1 });
matchSchema.index({ playerB: 1, gameCategory: 1, createdAt: -1 });

export const Match = mongoose.model('Match', matchSchema);