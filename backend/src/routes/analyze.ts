import { Router, Request, Response } from 'express';
import { Chess } from 'chess.js';
import { analyzePosition } from '../stockfish';

const router = Router();

// Move quality thresholds in centipawns
const BLUNDER_CP = 200;
const MISTAKE_CP = 100;
const INACCURACY_CP = 50;

function classifyMove(prevCp: number, currCp: number, movedColor: 'w' | 'b'): string {
  // Express both scores from the perspective of who just moved
  const before = movedColor === 'w' ? prevCp : -prevCp;
  const after  = movedColor === 'w' ? currCp : -currCp;
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

    // Convert best move (UCI) to SAN
    let bestMoveSan: string | null = null;
    try {
      const chess = new Chess(fen);
      const move = chess.move({ from: current.bestMove.slice(0, 2), to: current.bestMove.slice(2, 4), promotion: current.bestMove[4] });
      bestMoveSan = move?.san ?? null;
    } catch { /* position might be game-over */ }

    // Determine move quality if we have the previous position
    let moveQuality: string | null = null;
    if (previous) {
      // The side that just moved is indicated by the turn in previousFen
      const prevChess = new Chess(previousFen);
      const movedColor = prevChess.turn(); // 'w' or 'b'
      moveQuality = classifyMove(previous.scoreCp, current.scoreCp, movedColor);
    }

    res.json({
      scoreCp: current.scoreCp,
      bestMove: current.bestMove,
      bestMoveSan,
      moveQuality,
    });
  } catch (err) {
    console.error('POST /analyze error:', err);
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export default router;
