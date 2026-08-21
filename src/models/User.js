import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const userSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: [true, 'Username is required'], 
      unique: true, 
      trim: true,
      lowercase: true,
      index: true 
    },
    email: { 
      type: String, 
      required: [true, 'Email is required'], 
      unique: true, 
      trim: true,
      lowercase: true 
    },
    passwordHash: { 
      type: String, 
      required: [true, 'Password is required'],
      select: false // Exclude password from query results by default
    },
    region: { 
      type: String, 
      default: 'GLOBAL', 
      uppercase: true,
      index: true 
    },
    eloRating: { 
      type: Number, 
      default: 1200, 
      index: true 
    },
    stats: {
      quickMath: { highScore: { type: Number, default: 0 }, gamesPlayed: { type: Number, default: 0 } },
      sudoku: { highScore: { type: Number, default: 0 }, gamesPlayed: { type: Number, default: 0 } },
      memory: { highScore: { type: Number, default: 0 }, gamesPlayed: { type: Number, default: 0 } },
      wordGame: { highScore: { type: Number, default: 0 }, gamesPlayed: { type: Number, default: 0 } },
    },
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.passwordHash);
};

// Instance method: Generate signed JWT
userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, username: this.username, region: this.region },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );
};

export const User = mongoose.model('User', userSchema);