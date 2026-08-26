// utils/updateStreak.js
export const updateDailyStreak = async (user) => {
  const now = new Date();
  const lastPlayed = user.streak?.lastPlayedDate ? new Date(user.streak.lastPlayedDate) : null;

  const todayStr = now.toISOString().split('T')[0];

  if (!lastPlayed) {
    // First game ever played
    user.streak.currentStreak = 1;
    user.streak.longestStreak = 1;
    user.streak.lastPlayedDate = now;
    await user.save();
    return;
  }

  const lastPlayedStr = lastPlayed.toISOString().split('T')[0];

  if (todayStr === lastPlayedStr) {
    // Already played today, no change
    return;
  }

  // Calculate day difference
  const diffTime = Math.abs(new Date(todayStr) - new Date(lastPlayedStr));
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    // Played yesterday -> Continue streak
    user.streak.currentStreak += 1;
    if (user.streak.currentStreak > user.streak.longestStreak) {
      user.streak.longestStreak = user.streak.currentStreak;
    }
  } else {
    // Missed a day -> Reset streak
    if (user.streak.streakFreezeCount > 0) {
      // Use streak freeze protection if available
      user.streak.streakFreezeCount -= 1;
    } else {
      user.streak.currentStreak = 1;
    }
  }

  user.streak.lastPlayedDate = now;
  await user.save();
};