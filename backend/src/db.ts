import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/chess';

export async function connectDB(): Promise<void> {
  await mongoose.connect(MONGODB_URI);
  const host = MONGODB_URI.replace(/^mongodb(\+srv)?:\/\/[^@]+@/, '').split('/')[0];
  console.log('Connected to MongoDB at', host);
}
