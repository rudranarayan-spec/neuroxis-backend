// utils/shikakuValidator.js

/**
 * Validates a user's submitted Shikaku solution.
 * @param {Array<Array<number>>} initialBoard - The puzzle clue matrix (0s and numbers).
 * @param {Array<{r1: number, c1: number, r2: number, c2: number}>} rects - Array of rectangles drawn by user.
 * @param {number} gridSize - Size of the grid (e.g., 5 for 5x5).
 */
export const validateShikakuSolution = (initialBoard, rects, gridSize) => {
  // 1. Grid ownership tracker (0 = uncovered, 1 = covered)
  const coveredGrid = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
  let totalCoveredArea = 0;

  for (const rect of rects) {
    const { r1, c1, r2, c2 } = rect;

    // Normalize top-left and bottom-right points
    const minR = Math.min(r1, r2);
    const maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2);
    const maxC = Math.max(c1, c2);

    // Calculate dimensions & area
    const width = maxC - minC + 1;
    const height = maxR - minR + 1;
    const rectArea = width * height;

    let numbersFoundInRect = [];

    // Scan cells inside this rectangle
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        // Bounds check
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) {
          return { valid: false, message: 'Rectangle exceeds grid boundaries.' };
        }

        // Overlap check
        if (coveredGrid[r][c] === 1) {
          return { valid: false, message: 'Overlapping rectangles detected.' };
        }

        coveredGrid[r][c] = 1;
        totalCoveredArea++;

        // Collect clues inside this rectangle
        if (initialBoard[r][c] > 0) {
          numbersFoundInRect.push(initialBoard[r][c]);
        }
      }
    }

    // Rule Check A: Must contain EXACTLY ONE clue
    if (numbersFoundInRect.length !== 1) {
      return {
        valid: false,
        message: `Rectangle at (${minR},${minC}) must contain exactly one clue number.`,
      };
    }

    // Rule Check B: Area must match clue value
    const targetArea = numbersFoundInRect[0];
    if (rectArea !== targetArea) {
      return {
        valid: false,
        message: `Rectangle area (${rectArea}) does not match clue value (${targetArea}).`,
      };
    }
  }

  // Rule Check C: Entire grid must be covered completely
  if (totalCoveredArea !== gridSize * gridSize) {
    return { valid: false, message: 'The entire grid must be covered.' };
  }

  return { valid: true };
};