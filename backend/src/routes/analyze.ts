import { Router, Request, Response } from 'express';
import { Chess } from 'chess.js';
import { analyzePosition } from '../stockfish';
import { generateCoachMessage } from '../coaching';
import logger from '../logger';

const router = Router();

// Move quality thresholds in centipawns
const BLUNDER_CP = 200;
const MISTAKE_CP = 100;
const INACCURACY_CP = 50;

function classifyMove(prevCp: number, currCp: number, movedColor: 'w' | 'b'): { quality: string; evalDropCp: number } {
  // Stockfish always reports score from the side-to-move's perspective.
  // prevCp: movedColor is to move → positive = movedColor winning
  // currCp: opponent is to move  → positive = opponent winning, so negate for movedColor
  const before = movedColor === 'w' ? prevCp  : -prevCp;
  const after  = movedColor === 'w' ? -currCp :  currCp;
  const drop = before - after;

  let quality: string;
  if (drop >= BLUNDER_CP)    quality = 'blunder';
  else if (drop >= MISTAKE_CP)    quality = 'mistake';
  else if (drop >= INACCURACY_CP) quality = 'inaccuracy';
  else if (drop <= -50)           quality = 'excellent';
  else                            quality = 'good';

  return { quality, evalDropCp: drop };
}

router.post('/', async (req: Request, res: Response) => {
  const { fen, previousFen, playerMoveSan, isOpponent } = req.body;

  if (!fen || typeof fen !== 'string') {
    res.status(400).json({ error: 'fen is required' }); return;
  }

  // Validate FEN
  try { new Chess(fen); } catch {
    res.status(400).json({ error: 'Invalid FEN' }); return;
  }

  try {
    let current: Awaited<ReturnType<typeof analyzePosition>> | null = null;
    let previous: Awaited<ReturnType<typeof analyzePosition>> | null = null;

    try {
      [current, previous] = await Promise.all([
        analyzePosition(fen),
        previousFen && typeof previousFen === 'string' ? analyzePosition(previousFen) : null,
      ]);
    } catch (err) {
      logger.warn({ err }, 'Stockfish unavailable — returning partial analysis');
    }

    // Determine move quality + best alternative if we have the previous position
    let moveQuality: string | null = null;
    let evalDropCp: number | null = null;
    let bestMove: string | null = current?.bestMove ?? null;
    let bestMoveSan: string | null = null;
    let bestMovePosition: { fen: string; from: string; to: string; san: string } | null = null;
    let alternatives: Array<{ moveSan: string; scoreCp: number; mateIn: number | null }> = [];
    let mateIn: number | null = current?.mateIn ?? null;
    let scoreCp: number | null = null;
    let pv: string | null = null;
    let pvPositions: Array<{ fen: string; from: string; to: string; san: string }> = [];

    if (current) {
      if (previous) {
        // The side that just moved is indicated by the turn in previousFen
        const prevChess = new Chess(previousFen);
        const movedColor = prevChess.turn();
        const classified = classifyMove(previous.scoreCp, current.scoreCp, movedColor);
        moveQuality = classified.quality;
        evalDropCp = classified.evalDropCp;

        // "Best move" = what the player should have played (from the previous position)
        bestMove = previous.bestMove;
        try {
          const chess2 = new Chess(previousFen);
          const m = chess2.move({ from: previous.bestMove.slice(0, 2), to: previous.bestMove.slice(2, 4), promotion: previous.bestMove[4] });
          if (m) {
            bestMoveSan = m.san;
            bestMovePosition = { fen: chess2.fen(), from: m.from, to: m.to, san: m.san };
          }
        } catch { /* game-over position */ }

        // Alternative moves the player could have played (lines 2 & 3 from previous position)
        for (const alt of previous.alternatives) {
          try {
            const c = new Chess(previousFen);
            const m = c.move({ from: alt.bestMove.slice(0, 2), to: alt.bestMove.slice(2, 4), promotion: alt.bestMove[4] });
            if (m) {
              const altScoreCp = movedColor === 'w' ? alt.scoreCp : -alt.scoreCp;
              alternatives.push({ moveSan: m.san, scoreCp: altScoreCp, mateIn: alt.mateIn });
            }
          } catch { /* skip */ }
        }
      } else {
        // No previous position — show best move from current position
        try {
          const chess = new Chess(fen);
          const m = chess.move({ from: current.bestMove.slice(0, 2), to: current.bestMove.slice(2, 4), promotion: current.bestMove[4] });
          bestMoveSan = m?.san ?? null;
        } catch { /* game-over position */ }
      }

      // Normalise scoreCp to white's perspective (positive = white winning).
      const chess3 = new Chess(fen);
      const turn = chess3.turn();
      scoreCp = turn === 'w' ? current.scoreCp : -current.scoreCp;

      // Convert PV from UCI: formatted text + positions for board animation
      if (current.pv) {
        try {
          const pvChess = new Chess(fen);
          const fenParts = fen.split(' ');
          let moveNum = parseInt(fenParts[5]) || 1;
          let isWhite = fenParts[1] === 'w';
          const parts: string[] = [];

          for (const uci of current.pv.split(' ').slice(0, 8)) {
            const m = pvChess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
            if (!m) break;
            pvPositions.push({ fen: pvChess.fen(), from: m.from, to: m.to, san: m.san });
            if (isWhite) {
              parts.push(`${moveNum}. ${m.san}`);
            } else {
              if (parts.length === 0) parts.push(`${moveNum}… ${m.san}`);
              else parts[parts.length - 1] += ` ${m.san}`;
              moveNum++;
            }
            isWhite = !isWhite;
          }
          pv = parts.join(' ');
        } catch { /* leave null */ }
      }
    }

    // Generate LLM coaching message (non-blocking — falls back to '' if unavailable)
    const coachMessage = await generateCoachMessage({
      playerMoveSan: typeof playerMoveSan === 'string' ? playerMoveSan : null,
      moveQuality,
      evalDropCp,
      scoreCp: scoreCp ?? 0,
      bestMoveSan,
      mateIn,
      alternatives,
      pv,
      isOpponent: isOpponent === true,
    }).catch(() => '');

    res.json({
      scoreCp,
      bestMove,
      bestMoveSan,
      bestMovePosition: bestMovePosition ?? null,
      moveQuality,
      evalDropCp,
      mateIn,
      alternatives,
      pv,
      pvPositions,
      pvStartMoveNum: parseInt(fen.split(' ')[5]) || 1,
      pvStartWhite: fen.split(' ')[1] === 'w',
      coachMessage,
    });
  } catch (err) {
    logger.error({ err }, 'POST /analyze failed');
    res.status(500).json({ error: 'Analysis failed' });
  }
});

export default router;
