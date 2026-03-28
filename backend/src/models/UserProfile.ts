import mongoose, { Document, Schema } from 'mongoose';

export interface IUserProfile extends Document {
  userId: string;
  displayName: string;
  piece: string;
  color: string;
  premiumExpiresAt?: Date;
}

const UserProfileSchema = new Schema<IUserProfile>(
  {
    userId:           { type: String, required: true, unique: true, index: true },
    displayName:      { type: String, default: '' },
    piece:            { type: String, default: 'queen' },
    color:            { type: String, default: 'brown' },
    premiumExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const UserProfile = mongoose.model<IUserProfile>('UserProfile', UserProfileSchema);
