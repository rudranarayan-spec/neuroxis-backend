/**
 * Progression & Streak Engine for NEUROXIS
 */

/**
 * Calculates XP required to reach the next level.
 * Formula: 100 * (level ^ 1.5)
 * @param {number} level
 * @returns {number}
 */
export const getXpForNextLevel = (level = 1) => {
  return Math.floor(100 * Math.pow(level, 1.5));
};

export const calculateMatchXp = ({
  score = 0,
  isWin = false,
  mode = "SOLO",
}) => {
  const baseScoreXp = Math.floor(score / 10);
  const modeBonus = mode === "DUEL_1V1" ? 50 : 20;
  const winBonus = isWin ? 50 : 0;

  return Math.max(10, baseScoreXp + modeBonus + winBonus);
};

export const processXpGain = (currentXp, xpGained, currentLevel) => {
  let newXp = currentXp + xpGained;
  let newLevel = currentLevel;
  let leveledUp = false;

  let requiredXp = getXpForNextLevel(newLevel);
  while (newXp >= requiredXp) {
    newXp -= requiredXp;
    newLevel += 1;
    leveledUp = true;
    requiredXp = getXpForNextLevel(newLevel);
  }

  return { newXp, newLevel, leveledUp };
};

/**
 * Evaluates and updates a user's daily streak state based on match completion time.
 * @param {Object} streakState - Existing user streak object from Mongoose
 * @returns {Object} Updated streak object
 */
export const processDailyStreak = (streakState = {}) => {
  const now = new Date();
  const lastPlayed = streakState.lastPlayedDate
    ? new Date(streakState.lastPlayedDate)
    : null;

  let {
    currentStreak = 0,
    longestStreak = 0,
    streakFreezeCount = 0,
  } = streakState;

  if (!lastPlayed) {
    // First game ever
    currentStreak = 1;
    longestStreak = 1;
  } else {
    // Standardize to UTC Start of Day for comparison
    const todayStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const lastPlayedStart = new Date(
      Date.UTC(
        lastPlayed.getUTCFullYear(),
        lastPlayed.getUTCMonth(),
        lastPlayed.getUTCDate(),
      ),
    );

    const diffInDays = Math.floor(
      (todayStart - lastPlayedStart) / (1000 * 60 * 60 * 24),
    );

    if (diffInDays === 1) {
      // Played yesterday: Increment streak
      currentStreak += 1;
      if (currentStreak > longestStreak) longestStreak = currentStreak;
    } else if (diffInDays > 1) {
      // Missed one or more days
      if (streakFreezeCount > 0) {
        // Consume a Streak Freeze to save the streak
        streakFreezeCount -= 1;
      } else {
        // Reset streak
        currentStreak = 1;
      }
    }
    // If diffInDays === 0 (already played today), do not increment, keep streak as is
  }

  return {
    currentStreak,
    longestStreak,
    lastPlayedDate: now,
    streakFreezeCount,
  };
};
