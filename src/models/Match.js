import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    gameType: { 
      type: String, 
      enum: ['quickMath', 'sudoku', 'memory', 'wordGame'], 
      required: true,
      index: true 
    },
    mode: { 
      type: String, 
      enum: ['SOLO', 'DUEL_1V1', 'TOURNAMENT'], 
      default: 'SOLO' 
    },
    
    // Players involved
    playerA: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    playerB: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Null for solo mode

    // Match Outcomes
    winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    isDraw: { type: Boolean, default: false },

    // Elo Delta (Track point shifts for auditing)
    playerAEloChange: { type: Number, default: 0 },
    playerBEloChange: { type: Number, default: 0 },

    // Anti-Cheat & Verification Metrics
    durationMs: { type: Number, required: true },
    seed: { type: String, required: true }, // Deterministic seed used to generate the puzzle
    moveLog: [{ type: String }], // Array of moves/inputs timestamped for anti-cheat validation
  },
  { timestamps: true }
);

export const Match = mongoose.model('Match', matchSchema);