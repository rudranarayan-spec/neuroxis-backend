import mongoose from 'mongoose';

export const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not defined in process.env. Check your .env file.");
    }

    const conn = await mongoose.connect(uri);
    console.log(`[NEUROXIS DB] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[NEUROXIS DB Error]: ${error.message}`);
    process.exit(1);
  }
};