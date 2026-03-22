import mongoose, { Document, Schema } from 'mongoose';

export type GameStatus = 'active' | 'check' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';
export type GameMode = 'pvp' | 'vs_computer' | 'multiplayer';

export interface IGame extends Document {
  userId: string;           // creator (all modes)
  whiteUserId: string | null; // multiplayer: white player
  blackUserId: string | null; // multiplayer: black player
  inviteCode: string | null;  // multiplayer: join code
  fen: string;
  status: GameStatus;
  mode: GameMode;
  computerLevel: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const GameSchema = new Schema<IGame>(
  {
    userId:       { type: String, required: true, index: true },
    whiteUserId:  { type: String, default: null },
    blackUserId:  { type: String, default: null },
    inviteCode:   { type: String, default: null, sparse: true },
    fen:          { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'check', 'checkmate', 'stalemate', 'draw', 'resigned'],
      default: 'active',
    },
    mode: {
      type: String,
      enum: ['pvp', 'vs_computer', 'multiplayer'],
      default: 'pvp',
    },
    computerLevel: { type: Number, default: null },
  },
  { timestamps: true }
);

export const Game = mongoose.model<IGame>('Game', GameSchema);
