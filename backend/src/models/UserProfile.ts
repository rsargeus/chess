import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProfile extends Document {
  userId: string;
  displayName: string;
  piece: string;
  color: string;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId:      { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: '' },
    piece:       { type: String, default: 'queen' },
    color:       { type: String, default: 'brown' },
  },
  { timestamps: true }
);

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
