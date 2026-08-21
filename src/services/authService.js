// // src/services/authService.js
// import { User } from '../models/User.js';

// export class AuthService {
//   static async registerUser({ username, email, password, region }) {
//     const existingUser = await User.findOne({ $or: [{ email }, { username }] });
//     if (existingUser) throw new Error('Username or Email already registered');

//     const user = await User.create({
//       username,
//       email,
//       passwordHash: password,
//       region: region ? region.toUpperCase() : 'GLOBAL',
//     });

//     const token = user.generateAuthToken();
//     return { token, user };
//   }

//   static async loginUser({ email, password }) {
//     if (!email || !password) throw new Error('Provide email and password');

//     const user = await User.findOne({ email }).select('+passwordHash');
//     if (!user || !(await user.comparePassword(password))) {
//       throw new Error('Invalid credentials');
//     }

//     const token = user.generateAuthToken();
//     return { token, user };
//   }
// }