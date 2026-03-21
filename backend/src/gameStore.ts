import { Chess } from 'chess.js';
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

export async function createGame(userId: string, mode: GameMode = 'pvp', computerLevel: number | null = null) {
  const chess = new Chess();
  const level = mode === 'vs_computer' ? (computerLevel ?? 5) : null;
  const game = await Game.create({ userId, fen: chess.fen(), status: 'active', mode, computerLevel: level });
  return {
    gameId: game._id.toString(),
    fen: game.fen,
    status: game.status,
    turn: chess.turn(),
    mode: game.mode,
    computerLevel: game.computerLevel,
  };
}

export async function listGames(userId: string) {
  const games = await Game.find({ userId }).sort({ createdAt: -1 }).lean();
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
  }));
}

export async function getGame(gameId: string, userId?: string) {
  const query = userId ? { _id: gameId, userId } : { _id: gameId };
  const game = await Game.findOne(query).lean();
  if (!game) return null;
  const moves = await Move.find({ gameId: game._id }).sort({ moveNumber: 1 }).lean();
  const chess = new Chess(game.fen);
  return {
    gameId: game._id.toString(),
    fen: game.fen,
    turn: chess.turn(),
    status: game.status,
    mode: game.mode,
    computerLevel: game.computerLevel,
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
  const query = userId ? { _id: gameId, userId } : { _id: gameId };
  const game = await Game.findOne(query);
  if (!game) return { error: 'Game not found', status: 404 };
  if (!['active', 'check'].includes(game.status)) {
    return { error: 'Game is already over', status: 400 };
  }

  const chess = new Chess(game.fen);
  let result;
  try {
    result = chess.move({ from, to, promotion: 'q' });
  } catch {
    return { error: 'Invalid move', status: 400 };
  }
  if (!result) return { error: 'Invalid move', status: 400 };

  let moveCount = await Move.countDocuments({ gameId: game._id });
  const playerMoveNumber = ++moveCount;
  const playerFenAfter = chess.fen();
  await saveMove(game._id, playerMoveNumber, from, to, result.san, playerFenAfter);

  let status = deriveStatus(chess);
  let computerMove: { san: string; from: string; to: string } | null = null;

  if (game.mode === 'vs_computer' && (status === 'active' || status === 'check')) {
    try {
      const level = game.computerLevel ?? 5;
      const uci = await getBestMove(chess.fen(), level);
      const { from: cf, to: ct, promotion: cp } = parseUciMove(uci);
      const compResult = chess.move({ from: cf, to: ct, promotion: cp ?? 'q' });
      await saveMove(game._id, ++moveCount, cf, ct, compResult.san, chess.fen());
      status = deriveStatus(chess);
      computerMove = { san: compResult.san, from: cf, to: ct };
    } catch (err) {
      console.error('Stockfish error, falling back to random move:', err);
      const fallback = randomMove(chess);
      if (fallback) {
        const compResult = chess.move(fallback);
        await saveMove(game._id, ++moveCount, fallback.from, fallback.to, compResult.san, chess.fen());
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

export async function resignGame(gameId: string, userId?: string) {
  const query = userId ? { _id: gameId, userId } : { _id: gameId };
  const game = await Game.findOne(query);
  if (!game) return false;
  game.status = 'resigned';
  await game.save();
  return true;
}
