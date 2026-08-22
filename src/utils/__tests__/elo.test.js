import { calculateExpectedScore, calculateMatchElo, calculateGlobalElo } from '../elo.js';

// Test Expected Win Rate (1200 vs 1400 should be ~0.24)
const expected = calculateExpectedScore(1200, 1400);
console.log('Expected Win Rate (1200 vs 1400):', expected); 

// Test 1v1 Upset Match (Player A with 1200 beats Player B with 1400)
const matchResult = calculateMatchElo({
  ratingA: 1200,
  ratingB: 1400,
  scoreA: 1, // Player A Wins
});

console.log('Elo Delta Result:', matchResult);
// Expected Output: Player A gains ~24 pts, Player B loses ~24 pts

// Test Global Elo Aggregation
const aggregatedElo = calculateGlobalElo({
  quickMath: 1300,
  sudoku: 1200,
  memory: 1250,
  wordGame: 1210,
});

console.log('Aggregated Global Elo:', aggregatedElo);