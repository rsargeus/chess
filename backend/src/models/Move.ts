import mongoose, { Document, Schema } from 'mongoose';

export interface IMove extends Document {
  gameId: mongoose.Types.ObjectId;
  moveNumber: number;
  from: string;
  to: string;
  san: string;
  fenAfter: string;
  playedAt: Date;
}

const MoveSchema = new Schema<IMove>({
  gameId: { type: Schema.Types.ObjectId, ref: 'Game', required: true, index: true },
  moveNumber: { type: Number, required: true },
  from: { type: String, required: true },
  to: { type: String, required: true },
  san: { type: String, required: true },
  fenAfter: { type: String, required: true },
  playedAt: { type: Date, default: Date.now },
});

export const Move = mongoose.model<IMove>('Move', MoveSchema);
