import { Router, Request, Response } from 'express';
import { Chess } from 'chess.js';
import { analyzePosition } from '../stockfish';

const router = Router();

// Move quality thresholds in centipawns
const BLUNDER_CP = 200;
const MISTAKE_CP = 100;
const INACCURACY_CP = 50;

function classifyMove(prevCp: number, currCp: number, movedColor: 'w' | 'b'): string {
  // Stockfish always reports score from the side-to-move's perspective.
  // prevCp: movedColor is to move → positive = movedColor winning
  // currCp: opponent is to move  → positive = opponent winning, so negate for movedColor
  const before = movedColor === 'w' ? prevCp  : -prevCp;
  const after  = movedColor === 'w' ? -currCp :  currCp;
  const drop = before - after;

  if (drop >= BLUNDER_CP)   return 'blunder';
  if (drop >= MISTAKE_CP)   return 'mistake';
  if (drop >= INACCURACY_CP) return 'inaccuracy';
  if (drop <= -50)           return 'excellent';
  return 'good';
}

router.post('/', async (req: Request, res: Response) => {
  const { fen, previousFen } = req.body;

  if (!fen || typeof fen !== 'string') {
    res.status(400).json({ error: 'fen is required' }); return;
  }

  // Validate FEN
  try { new Chess(fen); } catch {
    res.status(400).json({ error: 'Invalid FEN' }); return;
  }

  try {
    const [current, previous] = await Promise.all([
      analyzePosition(fen),
      previousFen && typeof previousFen === 'string' ? analyzePosition(previousFen) : null,
    ]);

    // Determine move quality + best alternative if we have the previous position
    let moveQuality: string | null = null;
    let bestMove = current.bestMove;
    let bestMoveSan: string | null = null;

    if (previous) {
      // The side that just moved is indicated by the turn in previousFen
      const prevChess = new Chess(previousFen);
      const movedColor = prevChess.turn();
      moveQuality = classifyMove(previous.scoreCp, current.scoreCp, movedColor);

      // "Best move" = what the player should have played (from the previous position)
      bestMove = previous.bestMove;
      try {
        const chess2 = new Chess(previousFen);
        const m = chess2.move({ from: previous.bestMove.slice(0, 2), to: previous.bestMove.slice(2, 4), promotion: previous.bestMove[4] });
        bestMoveSan = m?.san ?? null;
      } catch { /* game-over position */ }
    } else {
      // No previous position — show best move from current position
      try {
        const chess = new Chess(fen);
        const m = chess.move({ from: current.bestMove.slice(0, 2), to: current.bestMove.slice(2, 4), promotion: current.bestMove[4] });
        bestMoveSan = m?.san ?? null;
      } catch { /* game-over position */ }
    }

    // Normalise scoreCp to white's perspective (positive = white winning).
    // Stockfish always returns from the side-to-move's perspective, so negate when it's black's turn.
    const turn = new Chess(fen).turn();
    const scoreCp = turn === 'w' ? current.scoreCp : -current.scoreCp;

    res.json({
      scoreCp,
      bestMove,
      bestMoveSan,
      moveQuality,
    });
  } catch (err) {
    console.error('POST /analyze error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export default router;
