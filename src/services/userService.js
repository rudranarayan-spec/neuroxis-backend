import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { leaderboardService } from './leaderboardService.js';

export const userService = {
  async getUserProfile(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('User not found');

    // Sync live rank from Redis
    const rankData = await leaderboardService.getUserRank(userId.toString(), 'global');

    return {
      user,
      rank: rankData.rank || 0,
    };
  },


  async updateAvatar(userId, avatarUrl) {
    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) throw new Error('User not found');
    return user;
  },


  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new Error('Incorrect current password');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    return true;
  },


  async getUserStats(userId) {
    const user = await User.findById(userId).select('-password');
    if (!user) throw new Error('User not found');

    const rankData = await leaderboardService.getUserRank(userId.toString(), 'global');

    const totalMatches = user.stats?.matchesPlayed || 0;
    const wins = user.stats?.wins || 0;
    const losses = user.stats?.losses || 0;
    const winRate = totalMatches > 0 ? Number(((wins / totalMatches) * 100).toFixed(2)) : 0;

    return {
      globalElo: user.globalElo || 1200,
      globalRank: rankData.rank || 0,
      level: user.level || 1,
      xp: user.xp || 0,
      streak: user.streak || 0,
      highestStreak: user.stats?.highestStreak || 0,
      overall: {
        matchesPlayed: totalMatches,
        wins,
        losses,
        winRate: `${winRate}%`,
      },
      categoryElo: user.gameElo || {},
      recentPerformances: user.stats?.recentHistory || [],
    };
  },
};