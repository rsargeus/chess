import { Chess } from 'chess.js';
import crypto from 'crypto';
import { Game, GameMode, GameStatus } from './models/Game';
import { Move } from './models/Move';
import { getBestMove, parseUciMove } from './stockfish';

function deriveStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  if (chess.isCheck()) return 'check';
  return 'active';
}

function randomMove(chess: Chess) {
  const moves = chess.moves({ verbose: true });
  return moves.length ? moves[Math.floor(Math.random() * moves.length)] : null;
}

async function saveMove(
  gameId: unknown,
  moveNumber: number,
  from: string,
  to: string,
  san: string,
  fen: string
) {
  await Move.create({ gameId, moveNumber, from, to, san, fenAfter: fen, playedAt: new Date() });
}

function generateInviteCode(): string {
  return crypto.randomBytes(6).toString('hex'); // 12-char hex string
}

function playerColor(game: { whiteUserId: string | null; blackUserId: string | null }, userId: string): 'w' | 'b' | null {
  if (game.whiteUserId === userId) return 'w';
  if (game.blackUserId === userId) return 'b';
  return null;
}

function canAccess(game: { userId: string; whiteUserId: string | null; blackUserId: string | null }, userId: string): boolean {
  return game.userId === userId || game.whiteUserId === userId || game.blackUserId === userId;
}

export async function createGame(userId: string, mode: GameMode = 'pvp', computerLevel: number | null = null) {
  const chess = new Chess();
  const level = mode === 'vs_computer' ? (computerLevel ?? 5) : null;
  const isMultiplayer = mode === 'multiplayer';
  const game = await Game.create({
    userId,
    whiteUserId: isMultiplayer ? userId : null,
    blackUserId: null,
    inviteCode: isMultiplayer ? generateInviteCode() : null,
    fen: chess.fen(),
    status: 'active',
    mode,
    computerLevel: level,
  });
  return {
    gameId: game._id.toString(),
    fen: game.fen,
    status: game.status,
    turn: chess.turn(),
    mode: game.mode,
    computerLevel: game.computerLevel,
    inviteCode: game.inviteCode,
    playerColor: isMultiplayer ? 'w' : null,
  };
}

export async function joinGame(inviteCode: string, userId: string) {
  // findOneAndUpdate with blackUserId: null ensures atomic check-and-set
  const game = await Game.findOneAndUpdate(
    { inviteCode, blackUserId: null },
    { $set: { blackUserId: userId } },
    { new: true }
  );
  if (!game) {
    const existing = await Game.findOne({ inviteCode });
    if (!existing) return { error: 'Invalid invite code', status: 404 };
    if (existing.whiteUserId === userId) return { error: 'Cannot join your own game', status: 400 };
    return { error: 'Game is already full', status: 409 };
  }
  if (game.whiteUserId === userId) {
    // Roll back — user managed to join their own game (race edge case)
    await Game.findByIdAndUpdate(game._id, { $set: { blackUserId: null } });
    return { error: 'Cannot join your own game', status: 400 };
  }

  const chess = new Chess(game.fen);
  const moves = await Move.find({ gameId: game._id }).sort({ moveNumber: 1 }).lean();
  return {
    gameId: game._id.toString(),
    fen: game.fen,
    turn: chess.turn(),
    status: game.status,
    mode: game.mode,
    computerLevel: game.computerLevel,
    inviteCode: game.inviteCode,
    playerColor: 'b' as const,
    moves: moves.map((m) => ({
      moveNumber: m.moveNumber,
      from: m.from,
      to: m.to,
      san: m.san,
      fenAfter: m.fenAfter,
      playedAt: m.playedAt,
    })),
  };
}

export async function listGames(userId: string) {
  const games = await Game.find({
    $or: [{ userId }, { whiteUserId: userId }, { blackUserId: userId }],
  }).sort({ createdAt: -1 }).lean();

  const ids = games.map((g) => g._id);
  const counts = await Move.aggregate([
    { $match: { gameId: { $in: ids } } },
    { $group: { _id: '$gameId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((c) => [c._id.toString(), c.count]));

  return games.map((g) => ({
    gameId: g._id.toString(),
    status: g.status,
    mode: g.mode,
    computerLevel: g.computerLevel,
    createdAt: g.createdAt,
    moveCount: countMap.get(g._id.toString()) ?? 0,
    playerColor: g.mode === 'multiplayer' ? playerColor(g, userId) : null,
    waitingForOpponent: g.mode === 'multiplayer' && !g.blackUserId,
    turn: g.fen.split(' ')[1] as 'w' | 'b',
  }));
}

export async function getGame(gameId: string, userId?: string) {
  const game = await Game.findById(gameId).lean();
  if (!game) return null;
  if (userId && !canAccess(game, userId)) return null;

  const moves = await Move.find({ gameId: game._id }).sort({ moveNumber: 1 }).lean();
  const chess = new Chess(game.fen);
  return {
    gameId: game._id.toString(),
    fen: game.fen,
    turn: chess.turn(),
    status: game.status,
    mode: game.mode,
    computerLevel: game.computerLevel,
    inviteCode: game.inviteCode,
    playerColor: game.mode === 'multiplayer' && userId ? playerColor(game, userId) : null,
    waitingForOpponent: game.mode === 'multiplayer' && !game.blackUserId,
    moves: moves.map((m) => ({
      moveNumber: m.moveNumber,
      from: m.from,
      to: m.to,
      san: m.san,
      fenAfter: m.fenAfter,
      playedAt: m.playedAt,
    })),
  };
}

export async function applyMove(gameId: string, from: string, to: string, userId?: string) {
  const game = await Game.findById(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (userId && !canAccess(game, userId)) return { error: 'Game not found', status: 404 };
  if (!['active', 'check'].includes(game.status)) {
    return { error: 'Game is already over', status: 400 };
  }

  const chess = new Chess(game.fen);

  // Multiplayer: verify it's the right player's turn
  if (game.mode === 'multiplayer' && userId) {
    if (!game.blackUserId) return { error: 'Waiting for opponent to join', status: 400 };
    const color = playerColor(game, userId);
    if (color !== chess.turn()) return { error: 'Not your turn', status: 400 };
  }

  let result;
  try {
    result = chess.move({ from, to, promotion: 'q' });
  } catch {
    return { error: 'Invalid move', status: 400 };
  }
  if (!result) return { error: 'Invalid move', status: 400 };

  // Atomically increment moveCounter to get a unique, sequential move number
  const updatedGame = await Game.findByIdAndUpdate(
    game._id,
    { $inc: { moveCounter: 1 } },
    { new: true }
  );
  const playerMoveNumber = updatedGame!.moveCounter;
  const playerFenAfter = chess.fen();
  await saveMove(game._id, playerMoveNumber, from, to, result.san, playerFenAfter);

  let status = deriveStatus(chess);
  let computerMove: { san: string; from: string; to: string } | null = null;

  if (game.mode === 'vs_computer' && (status === 'active' || status === 'check')) {
    const inc2 = await Game.findByIdAndUpdate(game._id, { $inc: { moveCounter: 1 } }, { new: true });
    const compMoveNumber = inc2!.moveCounter;
    try {
      const level = game.computerLevel ?? 5;
      const uci = await getBestMove(chess.fen(), level);
      const { from: cf, to: ct, promotion: cp } = parseUciMove(uci);
      const compResult = chess.move({ from: cf, to: ct, promotion: cp ?? 'q' });
      await saveMove(game._id, compMoveNumber, cf, ct, compResult.san, chess.fen());
      status = deriveStatus(chess);
      computerMove = { san: compResult.san, from: cf, to: ct };
    } catch (err) {
      console.error('Stockfish error, falling back to random move:', err);
      const fallback = randomMove(chess);
      if (fallback) {
        const compResult = chess.move(fallback);
        await saveMove(game._id, compMoveNumber, fallback.from, fallback.to, compResult.san, chess.fen());
        status = deriveStatus(chess);
        computerMove = { san: compResult.san, from: fallback.from, to: fallback.to };
      }
    }
  }

  game.fen = chess.fen();
  game.status = status;
  await game.save();

  return {
    fen: chess.fen(),
    turn: chess.turn(),
    status,
    move: { moveNumber: playerMoveNumber, san: result.san, fenAfter: playerFenAfter },
    computerMove,
  };
}

export async function undoMove(gameId: string, userId: string) {
  const game = await Game.findById(gameId);
  if (!game) return { error: 'Game not found', status: 404 };
  if (!canAccess(game, userId)) return { error: 'Game not found', status: 404 };
  if (game.mode !== 'vs_computer') return { error: 'Undo is only available in vs Computer mode', status: 400 };

  // Find the last 2 moves (player + computer response), or 1 if only 1 exists
  const lastMoves = await Move.find({ gameId: game._id }).sort({ moveNumber: -1 }).limit(2).lean();
  if (lastMoves.length === 0) return { error: 'No moves to undo', status: 400 };

  // The FEN to restore is either the fenAfter of the move before these, or the initial FEN
  const minMoveNumber = Math.min(...lastMoves.map(m => m.moveNumber));
  const prevMove = await Move.findOne({ gameId: game._id, moveNumber: { $lt: minMoveNumber } })
    .sort({ moveNumber: -1 }).lean();
  const restoredFen = prevMove ? prevMove.fenAfter : new Chess().fen();

  await Move.deleteMany({ gameId: game._id, moveNumber: { $gte: minMoveNumber } });

  const chess = new Chess(restoredFen);
  game.fen = restoredFen;
  game.status = deriveStatus(chess);
  await game.save();

  const remainingMoves = await Move.find({ gameId: game._id }).sort({ moveNumber: 1 }).lean();
  return {
    gameId: game._id.toString(),
    fen: restoredFen,
    turn: chess.turn() as 'w' | 'b',
    status: game.status,
    mode: game.mode,
    computerLevel: game.computerLevel,
    inviteCode: game.inviteCode,
    playerColor: null as 'w' | 'b' | null,
    waitingForOpponent: false,
    moves: remainingMoves.map(m => ({
      moveNumber: m.moveNumber, from: m.from, to: m.to,
      san: m.san, fenAfter: m.fenAfter, playedAt: m.playedAt,
    })),
  };
}

export async function resignGame(gameId: string, userId?: string) {
  const game = await Game.findById(gameId);
  if (!game) return false;
  if (userId && !canAccess(game, userId)) return false;
  game.status = 'resigned';
  await game.save();
  return true;
}
