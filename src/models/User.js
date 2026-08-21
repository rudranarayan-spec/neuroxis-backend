import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    region: { type: String, default: "GLOBAL", uppercase: true, index: true },
    globalElo: { type: Number, default: 1200, index: true },
    gameElo: {
      quickMath: { type: Number, default: 1200 },
      sudoku: { type: Number, default: 1200 },
      memory: { type: Number, default: 1200 },
      wordGame: { type: Number, default: 1200 },
    },
    fairPlayScore: { type: Number, default: 100 },
    isBanned: { type: Boolean, default: false },

    // Password Reset Fields
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, username: this.username, region: this.region },
    process.env.JWT_SECRET,
    { expiresIn: "30d" },
  );
};

// Generate and hash password reset token (valid for 10 minutes)
userSchema.methods.getResetPasswordToken = function () {
  const resetToken = randomBytes(32).toString("hex");

  this.resetPasswordToken = createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

export const User = mongoose.model("User", userSchema);
