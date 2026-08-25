import { Chess } from 'chess.js';
import type { Opening, OpeningLine } from './openings';

export interface TrainingPosition {
  fen: string;
  moveIndex: number;   // index into line.moves (-1 = start)
  isPlayerMove: boolean;
}

export interface TrainingCallbacks {
  onRender: (fen: string, lastFrom: string | null, lastTo: string | null) => void;
  onStatus: (type: 'you' | 'ai' | 'branch' | 'ok' | 'err' | 'done', text: string) => void;
  onFeedback: (type: 'ok' | 'err' | 'hint' | 'branch' | null, text: string) => void;
  onProgress: (played: number, total: number) => void;
  onVariantName: (name: string) => void;
  onVariantDetected?: (name: string) => void;
  onActiveLineIds?: (activeIds: string[]) => void;
  onMatchingLineIds?: (activeIds: string[]) => void;
  onAutoSelected?: (lineId: string) => void;
  onHint: (fromSq: string, toSq: string) => void;
  onComplete: (openingMoves: { from: string; to: string }[]) => void;
}

interface StepMove {
  from: string;
  to: string;
  san: string;
}

interface Step {
  fen: string;        // position before this move
  fenAfter: string;   // position after this move
  move: StepMove;
  isPlayer: boolean;
}

export class TrainingSession {
  private opening: Opening;
  private line: OpeningLine;
  private steps: Step[] = [];
  private currentStep = 0;   // index of next step to complete
  private chess = new Chess();
  private callbacks: TrainingCallbacks;
  private allMoves: { from: string; to: string }[] = [];
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private autoOpponent = true;

  constructor(opening: Opening, line: OpeningLine, callbacks: TrainingCallbacks) {
    this.opening = opening;
    this.line = line;
    this.callbacks = callbacks;
    this.buildSteps();
  }

  setAutoOpponent(value: boolean): void {
    const wasManual = !this.autoOpponent;
    this.autoOpponent = value;
    if (this.currentStep >= this.steps.length) return;
    const step = this.steps[this.currentStep];
    if (!step.isPlayer) {
      this.cancelAiTimer();
      // re-trigger advance so mode change takes effect immediately
      this.advance();
    }
    void wasManual;
  }

  private buildSteps(): void {
    const chess = new Chess();
    this.steps = [];
    this.allMoves = [];

    for (let i = 0; i < this.line.moves.length; i++) {
      const fenBefore = chess.fen();
      let result;
      try {
        result = chess.move(this.line.moves[i]);
      } catch {
        console.warn(`Invalid SAN "${this.line.moves[i]}" at index ${i} in line "${this.line.name}"`);
        break;
      }
      if (!result) break;

      // For white side: even indices (0,2,4…) are white's moves = player's
      // For black side: odd indices (1,3,5…) are black's moves = player's
      const isPlayer = this.opening.side === 'white'
        ? i % 2 === 0
        : i % 2 === 1;

      this.steps.push({
        fen: fenBefore,
        fenAfter: chess.fen(),
        move: { from: result.from, to: result.to, san: result.san },
        isPlayer,
      });
      this.allMoves.push({ from: result.from, to: result.to });
    }
  }

  start(): void {
    this.currentStep = 0;
    this.chess = new Chess();
    this.cancelAiTimer();
    this.callbacks.onVariantName(this.line.name);
    this.callbacks.onProgress(0, this.steps.length);
    this.callbacks.onRender(this.chess.fen(), null, null);
    this.callbacks.onFeedback(null, '');
    this.advance();
  }

  // Continue training from a position already on the board (used after global explore auto-selects)
  startFrom(moveIndex: number, fen: string): void {
    this.currentStep = moveIndex;
    this.chess = new Chess(fen);
    this.cancelAiTimer();
    this.callbacks.onVariantName(this.line.name);
    this.callbacks.onProgress(moveIndex, this.steps.length);
    // Render to flip board correctly for black openings
    this.callbacks.onRender(fen, null, null);
    this.callbacks.onFeedback(null, '');
    this.advance();
  }

  private advance(): void {
    if (this.currentStep >= this.steps.length) {
      this.callbacks.onStatus('done', '🏆 Öppningen klar!');
      this.callbacks.onFeedback('ok', 'Perfekt! Du spelade igenom hela varianten korrekt.');
      this.callbacks.onComplete(this.allMoves);
      return;
    }

    const step = this.steps[this.currentStep];
    if (step.isPlayer) {
      this.callbacks.onStatus('you', 'Din tur — spela rätt drag!');
    } else if (this.autoOpponent) {
      this.callbacks.onStatus('ai', 'Motståndaren tänker…');
      this.aiTimer = setTimeout(() => this.playAiStep(), 700);
    } else {
      this.callbacks.onStatus('you', 'Flytta motståndarens pjäs');
    }
  }

  private playAiStep(): void {
    if (this.currentStep >= this.steps.length) return;
    const step = this.steps[this.currentStep];
    this.chess.move({ from: step.move.from, to: step.move.to, promotion: 'q' });
    this.callbacks.onRender(this.chess.fen(), step.move.from, step.move.to);
    this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${step.move.san}`);
    this.currentStep++;
    this.callbacks.onProgress(this.currentStep, this.steps.length);
    setTimeout(() => this.advance(), 600);
  }

  onSquareClick(from: string, to: string): void {
    if (this.currentStep >= this.steps.length) return;
    const step = this.steps[this.currentStep];

    if (!step.isPlayer && this.autoOpponent) return;

    const expected = step.move;
    if (from === expected.from && to === expected.to) {
      this.chess.move({ from, to, promotion: 'q' });
      this.callbacks.onRender(this.chess.fen(), from, to);
      if (step.isPlayer) {
        this.callbacks.onFeedback('ok', `✓ Rätt! ${expected.san}`);
      } else {
        this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${expected.san}`);
      }
      this.currentStep++;
      this.callbacks.onProgress(this.currentStep, this.steps.length);
      setTimeout(() => this.advance(), step.isPlayer ? 500 : 300);
    } else {
      this.callbacks.onStatus('err', 'Fel drag — försök igen!');
      this.callbacks.onFeedback('err', `✗ Inte rätt drag. Försök igen eller klicka 💡 för ledtråd.`);
    }
  }

  showHint(): void {
    if (this.currentStep >= this.steps.length) return;
    const step = this.steps[this.currentStep];
    if (!step.isPlayer && this.autoOpponent) return;
    const { from, to, san } = step.move;
    this.callbacks.onHint(from, to);
    this.callbacks.onFeedback('hint', `💡 Rätt drag i öppningen: ${from}→${to} (${san})`);
  }

  reset(): void {
    this.cancelAiTimer();
    this.start();
  }

  getOpeningMoves(): { from: string; to: string }[] {
    return this.allMoves;
  }

  private cancelAiTimer(): void {
    if (this.aiTimer !== null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  destroy(): void {
    this.cancelAiTimer();
  }
}

// ── OpeningExploreSession ────────────────────────────────────────────────────
// Plays all variants of an opening simultaneously. Opponent moves are chosen
// randomly among the moves that still appear in at least one active line.
// The moment any move (by either side) reduces the active lines to one,
// the variant is announced via onVariantDetected.

export class OpeningExploreSession {
  private opening: Opening;
  private allLines: OpeningLine[];
  private activeLines: OpeningLine[];
  private chess: Chess;
  private moveIndex = 0;
  private variantDetermined = false;
  private callbacks: TrainingCallbacks;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private autoOpponent = true;

  constructor(opening: Opening, callbacks: TrainingCallbacks) {
    this.opening = opening;
    this.allLines = opening.lines;
    this.activeLines = [...opening.lines];
    this.chess = new Chess();
    this.callbacks = callbacks;
  }

  setAutoOpponent(value: boolean): void {
    this.autoOpponent = value;
    if (!this.isPlayerMove()) {
      this.cancelAiTimer();
      this.advance();
    }
  }

  private isPlayerMove(): boolean {
    return this.opening.side === 'white'
      ? this.moveIndex % 2 === 0
      : this.moveIndex % 2 === 1;
  }

  private totalMoves(): number {
    return Math.max(...this.activeLines.map(l => l.moves.length), 0);
  }

  start(): void {
    this.moveIndex = 0;
    this.activeLines = [...this.allLines];
    this.variantDetermined = false;
    this.chess = new Chess();
    this.cancelAiTimer();
    this.callbacks.onVariantName('Varianten avgörs…');
    this.callbacks.onProgress(0, this.totalMoves());
    this.callbacks.onRender(this.chess.fen(), null, null);
    this.callbacks.onFeedback(null, '');
    this.advance();
  }

  private advance(): void {
    // Drop lines that have ended
    const remaining = this.activeLines.filter(l => this.moveIndex < l.moves.length);
    if (remaining.length === 0) {
      const line = this.activeLines[0] ?? this.allLines[0];
      const allMoves = this.buildMovesFromLine(line);
      this.callbacks.onStatus('done', '🏆 Öppningen klar!');
      this.callbacks.onFeedback('ok', 'Perfekt! Du spelade igenom hela varianten korrekt.');
      this.callbacks.onComplete(allMoves);
      return;
    }
    this.activeLines = remaining;

    if (this.isPlayerMove()) {
      this.callbacks.onStatus('you', 'Din tur — spela rätt drag!');
    } else if (this.autoOpponent) {
      this.callbacks.onStatus('ai', 'Motståndaren tänker…');
      this.aiTimer = setTimeout(() => this.playAiStep(), 700);
    } else {
      this.callbacks.onStatus('you', 'Flytta motståndarens pjäs');
    }
  }

  private playAiStep(): void {
    // Collect distinct opponent moves from active lines at this index
    const moveSans = [...new Set(
      this.activeLines
        .filter(l => this.moveIndex < l.moves.length)
        .map(l => l.moves[this.moveIndex])
    )];
    if (moveSans.length === 0) return;

    // Pick randomly
    const san = moveSans[Math.floor(Math.random() * moveSans.length)];
    let result;
    try {
      result = this.chess.move(san);
    } catch {
      return;
    }
    if (!result) return;

    // Filter active lines to those that played this move
    this.activeLines = this.activeLines.filter(l => l.moves[this.moveIndex] === san);
    this.moveIndex++;

    this.callbacks.onRender(this.chess.fen(), result.from, result.to);
    this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${result.san}`);
    this.callbacks.onProgress(this.moveIndex, this.totalMoves());
    this.callbacks.onActiveLineIds?.(this.activeLines.map(l => l.id));

    this.checkVariantDetermined();
    setTimeout(() => this.advance(), 600);
  }

  private checkVariantDetermined(): void {
    if (this.variantDetermined || this.activeLines.length !== 1) return;
    this.variantDetermined = true;
    const line = this.activeLines[0];
    this.callbacks.onVariantName(line.name);
    this.callbacks.onVariantDetected?.(line.name);
  }

  onSquareClick(from: string, to: string): void {
    if (!this.isPlayerMove() && this.autoOpponent) return;

    const wasPlayerMove = this.isPlayerMove();

    // Find active lines where the next move (player or opponent) matches from/to
    const matchingLines = this.activeLines.filter(line => {
      if (this.moveIndex >= line.moves.length) return false;
      const tmp = new Chess(this.chess.fen());
      try {
        const r = tmp.move(line.moves[this.moveIndex]);
        return r?.from === from && r?.to === to;
      } catch { return false; }
    });

    if (matchingLines.length === 0) {
      this.callbacks.onStatus('err', 'Fel drag — försök igen!');
      this.callbacks.onFeedback('err', '✗ Det draget är inte i öppningsboken. Försök igen eller klicka 💡.');
      return;
    }

    let result;
    try {
      result = this.chess.move({ from, to, promotion: 'q' });
    } catch { return; }
    if (!result) return;

    this.activeLines = matchingLines;
    this.moveIndex++;

    this.callbacks.onRender(this.chess.fen(), from, to);
    if (wasPlayerMove) {
      this.callbacks.onFeedback('ok', `✓ Rätt! ${result.san}`);
    } else {
      this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${result.san}`);
    }
    this.callbacks.onProgress(this.moveIndex, this.totalMoves());
    this.callbacks.onActiveLineIds?.(this.activeLines.map(l => l.id));

    this.checkVariantDetermined();
    setTimeout(() => this.advance(), wasPlayerMove ? 500 : 300);
  }

  showHint(): void {
    if (!this.isPlayerMove() && this.autoOpponent) return;
    if (this.activeLines.length === 0) return;

    const line = this.activeLines[0];
    if (this.moveIndex >= line.moves.length) return;

    const tmp = new Chess(this.chess.fen());
    try {
      const r = tmp.move(line.moves[this.moveIndex]);
      if (!r) return;
      this.callbacks.onHint(r.from, r.to);
      const suffix = this.activeLines.length > 1
        ? ' (flera varianter möjliga)'
        : `: från ${r.from} till ${r.to}`;
      this.callbacks.onFeedback('hint', `💡 Flytta ${r.san}${suffix}`);
    } catch {}
  }

  reset(): void {
    this.cancelAiTimer();
    this.start();
  }

  getOpeningMoves(): { from: string; to: string }[] {
    const line = this.activeLines[0] ?? this.allLines[0];
    return this.buildMovesFromLine(line);
  }

  private buildMovesFromLine(line: OpeningLine): { from: string; to: string }[] {
    const chess = new Chess();
    const moves: { from: string; to: string }[] = [];
    for (const san of line.moves) {
      try {
        const r = chess.move(san);
        if (r) moves.push({ from: r.from, to: r.to });
      } catch { break; }
    }
    return moves;
  }

  private cancelAiTimer(): void {
    if (this.aiTimer !== null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  destroy(): void {
    this.cancelAiTimer();
  }
}

// ── GlobalExploreSession ─────────────────────────────────────────────────────
// Starts from the initial position with ALL openings available. The player
// plays white; the opponent auto-plays black from the still-matching lines.
// After every half-move the library is notified with the set of matching IDs.

interface LineData {
  lineId: string;
  moves: { from: string; to: string }[];   // pre-computed from SAN
}

function buildLineData(openings: Opening[]): LineData[] {
  const result: LineData[] = [];
  for (const op of openings) {
    for (const line of op.lines) {
      const chess = new Chess();
      const moves: { from: string; to: string }[] = [];
      for (const san of line.moves) {
        try {
          const r = chess.move(san);
          if (!r) break;
          moves.push({ from: r.from, to: r.to });
        } catch { break; }
      }
      result.push({ lineId: line.id, moves });
    }
  }
  return result;
}

export class GlobalExploreSession {
  private allLineData: LineData[];
  private activeLineData: LineData[];
  private chess: Chess;
  private moveIndex = 0;           // half-moves played
  private autoSelectedFired = false;
  private callbacks: TrainingCallbacks;
  private aiTimer: ReturnType<typeof setTimeout> | null = null;
  private autoOpponent = true;
  readonly playerSide: 'white' | 'black';

  constructor(openings: Opening[], playerSide: 'white' | 'black', callbacks: TrainingCallbacks) {
    this.playerSide = playerSide;
    const sideOpenings = openings.filter(op => op.side === playerSide);
    this.allLineData = buildLineData(sideOpenings);
    this.activeLineData = [...this.allLineData];
    this.chess = new Chess();
    this.callbacks = callbacks;
  }

  getCurrentFen(): string { return this.chess.fen(); }
  getCurrentMoveIndex(): number { return this.moveIndex; }

  setAutoOpponent(value: boolean): void {
    this.autoOpponent = value;
    if (!this.isPlayerTurn()) {
      this.cancelAiTimer();
      if (value) {
        this.callbacks.onStatus('ai', 'Motståndaren svarar…');
        this.aiTimer = setTimeout(() => this.playAiStep(), 600);
      } else {
        this.callbacks.onStatus('you', 'Flytta motståndarens pjäs');
      }
    }
  }

  start(): void {
    this.chess = new Chess();
    this.moveIndex = 0;
    this.autoSelectedFired = false;
    this.activeLineData = [...this.allLineData];
    this.cancelAiTimer();
    this.callbacks.onVariantName('');
    this.callbacks.onProgress(0, 0);
    this.callbacks.onFeedback(null, '');
    this.callbacks.onRender(this.chess.fen(), null, null);
    this.callbacks.onMatchingLineIds?.(this.activeLineData.map(d => d.lineId));
    if (this.playerSide === 'black' && this.autoOpponent) {
      this.callbacks.onStatus('ai', 'Motståndaren öppnar…');
      this.aiTimer = setTimeout(() => this.playAiStep(), 800);
    } else if (this.playerSide === 'black' && !this.autoOpponent) {
      this.callbacks.onStatus('you', 'Flytta motståndarens pjäs');
    } else {
      this.callbacks.onStatus('you', 'Gör ett drag för att utforska öppningar');
    }
  }

  // Player plays white on even moves, black on odd moves
  private isPlayerTurn(): boolean {
    return this.playerSide === 'white' ? this.moveIndex % 2 === 0 : this.moveIndex % 2 === 1;
  }

  onSquareClick(from: string, to: string): void {
    if (!this.isPlayerTurn() && this.autoOpponent) return;

    const wasPlayerTurn = this.isPlayerTurn();

    let result;
    try {
      result = this.chess.move({ from, to, promotion: 'q' });
    } catch { return; }
    if (!result) return;

    this.moveIndex++;
    this.filterActive();

    this.callbacks.onRender(this.chess.fen(), from, to);
    if (wasPlayerTurn) {
      this.callbacks.onFeedback('ok', `▸ ${result.san}`);
    } else {
      this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${result.san}`);
    }
    this.callbacks.onMatchingLineIds?.(this.activeLineData.map(d => d.lineId));

    if (this.activeLineData.length === 0) {
      this.callbacks.onStatus('you', 'Ingen känd öppning — välj en öppning i listan eller börja om');
      return;
    }

    if (!this.isPlayerTurn()) {
      // Now it's opponent's turn
      if (this.autoOpponent) {
        this.callbacks.onStatus('ai', 'Motståndaren svarar…');
        this.aiTimer = setTimeout(() => this.playAiStep(), 600);
      } else {
        this.callbacks.onStatus('you', 'Flytta motståndarens pjäs');
      }
    } else {
      this.callbacks.onStatus('you', 'Din tur');
    }
  }

  private playAiStep(): void {
    // Collect distinct black moves at this index from active lines
    const movesAtIndex = this.activeLineData
      .filter(d => this.moveIndex < d.moves.length)
      .map(d => d.moves[this.moveIndex]);

    if (movesAtIndex.length === 0) {
      // All active lines ended — opening complete
      this.callbacks.onStatus('you', 'Öppningens slut — välj en öppning i listan för att träna');
      return;
    }

    // Pick randomly among distinct opponent moves
    const distinct = [...new Map(movesAtIndex.map(m => [m.from + m.to, m])).values()];
    const chosen = distinct[Math.floor(Math.random() * distinct.length)];

    let result;
    try {
      result = this.chess.move({ from: chosen.from, to: chosen.to, promotion: 'q' });
    } catch { return; }
    if (!result) return;

    this.moveIndex++;
    this.filterActive();

    this.callbacks.onRender(this.chess.fen(), chosen.from, chosen.to);
    this.callbacks.onFeedback('branch', `▸ Motståndaren spelar ${result.san}`);
    this.callbacks.onMatchingLineIds?.(this.activeLineData.map(d => d.lineId));
    this.callbacks.onStatus('you', 'Din tur');
  }

  private filterActive(): void {
    const history = this.chess.history({ verbose: true });
    this.activeLineData = this.allLineData.filter(d => {
      if (history.length > d.moves.length) return false;
      return history.every((h, i) =>
        d.moves[i] && d.moves[i].from === h.from && d.moves[i].to === h.to
      );
    });

    // Auto-select when exactly one line remains
    if (!this.autoSelectedFired && this.activeLineData.length === 1) {
      this.autoSelectedFired = true;
      this.callbacks.onAutoSelected?.(this.activeLineData[0].lineId);
    }
  }

  showHint(): void {
    if (!this.isPlayerTurn() && this.autoOpponent) return;
    const available = this.activeLineData.filter(d => this.moveIndex < d.moves.length);
    if (available.length === 0) return;
    const { from, to } = available[0].moves[this.moveIndex];
    this.callbacks.onHint(from, to);
    this.callbacks.onFeedback('hint', `💡 Rätt drag i öppningen: ${from}→${to}`);
  }

  reset(): void {
    this.cancelAiTimer();
    this.start();
  }

  getOpeningMoves(): { from: string; to: string }[] {
    return this.chess.history({ verbose: true }).map(h => ({ from: h.from, to: h.to }));
  }

  private cancelAiTimer(): void {
    if (this.aiTimer !== null) {
      clearTimeout(this.aiTimer);
      this.aiTimer = null;
    }
  }

  destroy(): void {
    this.cancelAiTimer();
  }
}
