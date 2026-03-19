import mongoose, { Document, Schema } from 'mongoose';

export type GameStatus = 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
export type GameMode = 'pvp' | 'vs_computer';

export interface IGame extends Document {
  userId: string;
  fen: string;
  status: GameStatus;
  mode: GameMode;
  computerLevel: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    userId: { type: String, required: true, index: true },
    fen: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned'],
      default: 'active',
    },
    mode: {
      type: String,
      enum: ['pvp', 'vs_computer'],
      default: 'pvp',
    },
    computerLevel: { type: Number, default: null },
  },
  { timestamps: true }
);

export const Game = mongoose.model<IGame>('Game', GameSchema);
