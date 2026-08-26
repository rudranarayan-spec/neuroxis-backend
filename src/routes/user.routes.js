import { Router } from "express";
import {
  getProfile,
  updateAvatar,
  changePassword,
  getUserStats,
  getUserDashboardStats,
  getUserProfile
} from "../controllers/userController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Self endpoints
router.get("/me", protect, getProfile);
router.patch("/avatar", protect, updateAvatar);
router.patch("/change-password", protect, changePassword);
router.get("/stats", protect, getUserStats);
router.get('/dashboard-stats', protect, getUserDashboardStats);
router.get('/profile', protect, getUserProfile);

// Public/Other User lookup
router.get("/:id", protect, getProfile);
router.get("/:id/stats", protect, getUserStats);

export default router;
