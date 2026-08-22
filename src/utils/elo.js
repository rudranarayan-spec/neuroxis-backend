/**
 * Production Elo Engine for NEUROXIS
 */

const DEFAULT_K_FACTOR = 32;

/**
 * Calculates expected win probability of Player A against Player B
 * Formula: E_A = 1 / (1 + 10 ^ ((RatingB - RatingA) / 400))
 * 
 * @param {number} ratingA - Rating of Player A
 * @param {number} ratingB - Rating of Player B
 * @returns {number} Expected probability (between 0.0 and 1.0)
 */
export const calculateExpectedScore = (ratingA, ratingB) => {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

/**
 * Determines K-Factor based on games played to support placement volatility
 * 
 * @param {number} gamesPlayed 
 * @returns {number} Dynamic K-Factor
 */
export const getDynamicKFactor = (gamesPlayed = 0) => {
  if (gamesPlayed < 10) return 40;  // High placement mobility for new players
  if (gamesPlayed < 30) return 32;  // Mid-tier standard K-factor
  return 24;                        // Stable veteran K-factor
};

/**
 * Calculates new Elo ratings for both players post 1v1 match
 * 
 * @param {Object} params
 * @param {number} params.ratingA - Current rating of Player A
 * @param {number} params.ratingB - Current rating of Player B
 * @param {number} params.scoreA - Outcome for Player A (1 = Win, 0.5 = Draw, 0 = Loss)
 * @param {number} [params.gamesPlayedA=30] - Optional game history count for Player A
 * @param {number} [params.gamesPlayedB=30] - Optional game history count for Player B
 * 
 * @returns {Object} New ratings and point adjustments (deltas)
 */
export const calculateMatchElo = ({
  ratingA,
  ratingB,
  scoreA,
  gamesPlayedA = 30,
  gamesPlayedB = 30,
}) => {
  const expectedA = calculateExpectedScore(ratingA, ratingB);
  const expectedB = 1 - expectedA;

  const scoreB = 1 - scoreA;

  const kA = getDynamicKFactor(gamesPlayedA);
  const kB = getDynamicKFactor(gamesPlayedB);

  const deltaA = Math.round(kA * (scoreA - expectedA));
  const deltaB = Math.round(kB * (scoreB - expectedB));

  const newRatingA = Math.max(100, ratingA + deltaA); // Floor at 100
  const newRatingB = Math.max(100, ratingB + deltaB); // Floor at 100

  return {
    playerA: {
      newRating: newRatingA,
      delta: deltaA,
      expected: Number(expectedA.toFixed(2)),
    },
    playerB: {
      newRating: newRatingB,
      delta: deltaB,
      expected: Number(expectedB.toFixed(2)),
    },
  };
};

/**
 * Recalculates user's Global Elo as a weighted average across game categories
 * 
 * @param {Object} gameElo - Object containing category ratings
 * @returns {number} Aggregated global rating
 */
export const calculateGlobalElo = (gameElo = {}) => {
  const categories = Object.values(gameElo);
  if (!categories.length) return 1200;

  const total = categories.reduce((sum, rating) => sum + rating, 0);
  return Math.round(total / categories.length);
};