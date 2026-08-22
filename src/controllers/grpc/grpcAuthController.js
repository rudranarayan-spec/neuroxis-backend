import { User } from "../../models/User.js";

export const grpcAuthController = {
  async register(req) {
    try {
      const { username, email, password, region } = req;

      // Validate duplicate accounts
      const existingUser = await User.findOne({
        $or: [{ email }, { username }],
      });
      if (existingUser) {
        return {
          success: false,
          token: "",
          user: null,
          error: "Username or Email already registered",
        };
      }

      // Create new user in MongoDB
      const user = await User.create({
        username,
        email,
        passwordHash: password,
        region: region ? region.toUpperCase() : "GLOBAL",
      });

      const token = user.generateAuthToken();

      return {
        success: true,
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          region: user.region,
          globalElo: user.globalElo,
          xp: user.xp,
          level: user.level,
          currentStreak: user.streak?.currentStreak || 0,
        },
        error: "",
      };
    } catch (err) {
      return {
        success: false,
        token: "",
        user: null,
        error: err.message,
      };
    }
  },

  // 2. Login RPC
  async login(req) {
    try {
      const { email, password } = req;

      if (!email || !password) {
        return {
          success: false,
          token: "",
          user: null,
          error: "Provide email and password",
        };
      }

      const user = await User.findOne({ email }).select("+passwordHash");
      if (!user || !(await user.comparePassword(password))) {
        return {
          success: false,
          token: "",
          user: null,
          error: "Invalid credentials",
        };
      }

      const token = user.generateAuthToken();

      return {
        success: true,
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          region: user.region,
          globalElo: user.globalElo,
        },
        error: "",
      };
    } catch (err) {
      return {
        success: false,
        token: "",
        user: null,
        error: err.message,
      };
    }
  },

  // --- 3. Forgot Support RPC ---
  async forgotPassword(req) {
    try {
      const { email } = req;
      const user = await User.findOne({ email });

      if (!user) {
        return {
          success: false,
          message: "",
          resetToken: "",
          error: "User with this email does not exist",
        };
      }

      // Generate reset token
      const resetToken = user.getResetPasswordToken();
      await user.save({ validateBeforeSave: false });

      return {
        success: true,
        message: "Password reset token generated (valid for 10 minutes)",
        resetToken,
        error: "",
      };
    } catch (err) {
      return {
        success: false,
        message: "",
        resetToken: "",
        error: err.message,
      };
    }
  },

  // --- 2. ResetPassword RPC ---
  async resetPassword(req) {
    try {
      const { token, newPassword } = req;

      // Hash token to compare against database record
      const resetPasswordToken = createHash("sha256")
        .update(token)
        .digest("hex");

      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() },
      });

      if (!user) {
        return {
          success: false,
          token: "",
          user: null,
          error: "Invalid or expired token",
        };
      }

      // Update password and clear reset fields
      user.passwordHash = newPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save();

      const authToken = user.generateAuthToken();

      return {
        success: true,
        token: authToken,
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          region: user.region,
          globalElo: user.globalElo,
        },
        error: "",
      };
    } catch (err) {
      return {
        success: false,
        token: "",
        user: null,
        error: err.message,
      };
    }
  },
};
