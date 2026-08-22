import { processXpGain, processDailyStreak, calculateMatchXp } from '../progression.js';

// Test XP Gain & Leveling
const currentXp = 80;
const xpGained = calculateMatchXp({ score: 450, isWin: true, mode: 'DUEL_1V1' }); // ~145 XP
const { newXp, newLevel, leveledUp } = processXpGain(currentXp, xpGained, 1);

console.log('XP Gained:', xpGained);
console.log('Leveling Result:', { newXp, newLevel, leveledUp });

// Test Streak Processor
const streakResult = processDailyStreak({
  currentStreak: 5,
  longestStreak: 10,
  lastPlayedDate: new Date(Date.now() - 86400000 * 2), // Missed 2 days
  streakFreezeCount: 1, // Has 1 freeze
});

console.log('Streak Result with Freeze:', streakResult);