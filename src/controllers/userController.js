import { userService } from '../services/userService.js';

export const getProfile = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const profile = await userService.getUserProfile(userId);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    const { avatarUrl } = req.body;

    if (!avatarUrl) {
      return res.status(400).json({ success: false, error: 'Avatar URL is required' });
    }

    const updatedUser = await userService.updateAvatar(userId, avatarUrl);
    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Both current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long',
      });
    }

    await userService.changePassword(userId, currentPassword, newPassword);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
};

export const getUserStats = async (req, res) => {
  try {
    const userId = req.params.id || req.user.id;
    const stats = await userService.getUserStats(userId);
    res.status(200).json({ success: true, stats });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
};