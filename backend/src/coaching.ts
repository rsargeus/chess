import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const PIECE_NAMES: Record<string, string> = {
  K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight',
};

function sanToNatural(san: string): string {
  const clean = san.replace(/[+#!?]/g, '');
  if (clean === 'O-O-O') return 'queenside castling';
  if (clean === 'O-O')   return 'kingside castling';

  const captureMatch = clean.match(/^([KQRBN]?)([a-h]?[1-8]?)x([a-h][1-8])([QRBN]?)$/);
  if (captureMatch) {
    const [, piece, , to] = captureMatch;
    const name = piece ? PIECE_NAMES[piece] : 'pawn';
    return `${name} captures on ${to}`;
  }

  const moveMatch = clean.match(/^([KQRBN]?)([a-h]?[1-8]?)([a-h][1-8])([QRBN]?)$/);
  if (moveMatch) {
    const [, piece, , to, promo] = moveMatch;
    const name = piece ? PIECE_NAMES[piece] : 'pawn';
    const promoStr = promo ? `, promoting to ${PIECE_NAMES[promo] ?? promo}` : '';
    return `${name} to ${to}${promoStr}`;
  }

  return san;
}

export interface CoachingInput {
  playerMoveSan: string | null;
  moveQuality: string | null;
  evalDropCp: number | null;
  scoreCp: number;          // white's perspective
  bestMoveSan: string | null;
  mateIn: number | null;
  alternatives: Array<{ moveSan: string; scoreCp: number; mateIn: number | null }>;
  pv: string | null;
  isOpponent?: boolean;
}

export async function generateCoachMessage(input: CoachingInput): Promise<string> {
  if (!process.env.GROQ_API_KEY) return '';

  const {
    playerMoveSan, moveQuality, evalDropCp, scoreCp,
    bestMoveSan, mateIn, alternatives, pv, isOpponent,
  } = input;

  const evalStr = mateIn != null
    ? (mateIn > 0 ? `forced mate in ${mateIn}` : `opponent has forced mate in ${Math.abs(mateIn)}`)
    : `${scoreCp >= 0 ? '+' : ''}${(scoreCp / 100).toFixed(1)} pawns (white's perspective)`;

  const altsStr = alternatives.length
    ? alternatives.map(a => {
        const score = a.mateIn != null ? `M${Math.abs(a.mateIn)}` : `${(a.scoreCp / 100).toFixed(1)}`;
        return `${a.moveSan} (${score})`;
      }).join(', ')
    : 'none';

  const subject = isOpponent ? 'your opponent' : 'you';
  const possessive = isOpponent ? "your opponent's" : 'your';
  const opener = isOpponent ? 'Your opponent played' : 'You played';
  const moveNatural = playerMoveSan ? sanToNatural(playerMoveSan) : 'unknown';

  const prompt = `You are a friendly chess coach. Give brief, helpful feedback (2-3 sentences max) about ${possessive} last move.

${opener}: ${moveNatural} (${playerMoveSan ?? ''})
Move quality: ${moveQuality ?? 'unknown'}
Eval drop: ${evalDropCp != null ? `${(evalDropCp / 100).toFixed(1)} pawns lost by ${subject}` : 'n/a'}
Current eval: ${evalStr}
Best move instead: ${bestMoveSan ?? 'unknown'}
Other good moves: ${altsStr}
Best continuation: ${pv ?? 'unknown'}

Rules:
- Be concise (2-3 sentences)
- Start with "${opener} their ${moveNatural}..." or "${opener} your ${moveNatural}..." — describe the move in natural language, never use chess notation like "Kd1"
- Explain *why* the best move is better (tactics, structure, activity)
- If it was a good or excellent move by the opponent, note it as a threat or challenge
- Do not start with "Great move!" or similar filler — get to the point
- Write in English`;

  const chat = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 120,
    temperature: 0.5,
  });

  return chat.choices[0]?.message?.content?.trim() ?? '';
}
