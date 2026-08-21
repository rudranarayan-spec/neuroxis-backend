import { User } from "../models/User.js";

export const register = async (req, res) => {
  try {
    const { username, email, password, region } = req.body;

    const existingUser = await User.findOne({ $or: [{ email }, { username }] });
    if (existingUser) {
      return res
        .status(400)
        .json({
          success: false,
          error: "Username or Email already registered",
        });
    }

    const user = await User.create({
      username,
      email,
      passwordHash: password,
      region: region ? region.toUpperCase() : "GLOBAL",
    });

    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        region: user.region,
        eloRating: user.eloRating,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, error: "Provide email and password" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !(await user.comparePassword(password))) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid credentials" });
    }

    const token = user.generateAuthToken();

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        region: user.region,
        eloRating: user.eloRating,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
};
