import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import logger from './logger';

const LEVEL_CONFIG: Record<number, { elo?: number; movetime: number }> = {
  1:  { elo: 800,  movetime: 200 },
  2:  { elo: 1000, movetime: 200 },
  3:  { elo: 1200, movetime: 300 },
  4:  { elo: 1400, movetime: 300 },
  5:  { elo: 1600, movetime: 500 },
  6:  { elo: 1800, movetime: 500 },
  7:  { elo: 2000, movetime: 1000 },
  8:  { elo: 2200, movetime: 1000 },
  9:  { elo: 2600, movetime: 1500 },
  10: {            movetime: 3000 },
};

class StockfishEngine {
  private proc: ChildProcess;
  private buffer = '';
  private listeners: Array<(line: string) => boolean> = [];
  ready = false;
  private queue: Array<() => Promise<void>> = [];
  private running = false;

  private async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try { resolve(await fn()); } catch (e) { reject(e); }
      });
      if (!this.running) this.drain();
    });
  }

  private async drain(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      await task();
    }
    this.running = false;
  }

  constructor(binaryPath: string, args: string[] = []) {
    this.proc = spawn(binaryPath, args, { stdio: ['pipe', 'pipe', 'ignore'] });
    this.proc.stdout!.setEncoding('utf8');
    this.proc.stdout!.on('data', (chunk: string) => {
      this.buffer += chunk;
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        this.listeners = this.listeners.filter(fn => !fn(line));
      }
    });
  }

  private send(cmd: string): void {
    this.proc.stdin!.write(cmd + '\n');
  }

  private waitFor(pred: (line: string) => boolean, timeoutMs = 10000): Promise<string> {
    return new Promise((resolve, reject) => {
      let settled = false;
      let listener: ((line: string) => boolean) | null = null;

      const cleanup = () => {
        this.listeners = this.listeners.filter(fn => fn !== listener);
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        this.send('stop');
        reject(new Error('Stockfish timeout waiting for response'));
      }, timeoutMs);

      listener = (line: string) => {
        if (pred(line)) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(line);
          }
          return true;
        }
        return false;
      };

      this.listeners.push(listener);
    });
  }

  async init(): Promise<void> {
    this.send('uci');
    await this.waitFor(l => l === 'uciok', 60000);
    this.send('isready');
    await this.waitFor(l => l === 'readyok', 30000);
    this.ready = true;
  }

  async getBestMove(fen: string, level: number): Promise<string> {
    return this.enqueue(async () => {
      if (!this.ready) throw new Error('Engine not initialised');
      const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[5];

      this.send('ucinewgame');
      this.send('isready');
      await this.waitFor(l => l === 'readyok', 5000);

      if (cfg.elo !== undefined) {
        this.send('setoption name UCI_LimitStrength value true');
        this.send(`setoption name UCI_Elo value ${cfg.elo}`);
      } else {
        this.send('setoption name UCI_LimitStrength value false');
      }

      this.send(`position fen ${fen}`);
      this.send(`go movetime ${cfg.movetime}`);

      const line = await this.waitFor(l => l.startsWith('bestmove'), cfg.movetime + 5000);
      const move = line.split(' ')[1];
      if (!move || move === '(none)') throw new Error('Stockfish returned no move');
      logger.debug({ fen, level, move }, 'Stockfish best move');
      return move;
    });
  }

  async analyzePosition(fen: string, depth = 8): Promise<{
    scoreCp: number; bestMove: string; pv: string;
    mateIn: number | null;
    alternatives: Array<{ scoreCp: number; mateIn: number | null; bestMove: string; pv: string }>;
  }> {
    return this.enqueue(async () => {
      if (!this.ready) throw new Error('Engine not initialised');

      this.send('ucinewgame');
      this.send('isready');
      await this.waitFor(l => l === 'readyok', 5000);
      this.send('setoption name UCI_LimitStrength value false');
      this.send('setoption name MultiPV value 3');
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);

      type PvData = { scoreCp: number; mateIn: number | null; pv: string };
      const lastByPv: Record<number, PvData> = {};

      const line = await new Promise<string>((resolve, reject) => {
        let settled = false;
        let listener: ((line: string) => boolean) | null = null;

        const cleanup = () => { this.listeners = this.listeners.filter(fn => fn !== listener); };
        const timer = setTimeout(() => {
          if (settled) return;
          settled = true; cleanup(); this.send('stop');
          reject(new Error('Stockfish analyze timeout'));
        }, 15000);

        listener = (line: string) => {
          if (line.startsWith('info') && line.includes('score')) {
            const pvIdxMatch = line.match(/\bmultipv (\d+)\b/);
            const pvIdx = pvIdxMatch ? parseInt(pvIdxMatch[1]) : 1;
            const cpMatch   = line.match(/score cp (-?\d+)/);
            const mateMatch = line.match(/score mate (-?\d+)/);
            const pvMatch   = line.match(/ pv (.+)$/);
            const prev = lastByPv[pvIdx] ?? { scoreCp: 0, mateIn: null, pv: '' };
            let scoreCp = prev.scoreCp;
            let mateIn: number | null = prev.mateIn;
            if (cpMatch)   { scoreCp = parseInt(cpMatch[1]); mateIn = null; }
            else if (mateMatch) { const m = parseInt(mateMatch[1]); scoreCp = m > 0 ? 10000 : -10000; mateIn = m; }
            lastByPv[pvIdx] = { scoreCp, mateIn, pv: pvMatch ? pvMatch[1].trim() : prev.pv };
            return false;
          }
          if (line.startsWith('bestmove')) {
            if (!settled) { settled = true; clearTimeout(timer); resolve(line); }
            return true;
          }
          return false;
        };

        this.listeners.push(listener);
      });

      const bestMove = line.split(' ')[1];
      if (!bestMove || bestMove === '(none)') throw new Error('No move available');

      const main = lastByPv[1] ?? { scoreCp: 0, mateIn: null, pv: '' };
      const alternatives = [2, 3]
        .filter(i => lastByPv[i] && lastByPv[i].pv)
        .map(i => ({ ...lastByPv[i], bestMove: lastByPv[i].pv.split(' ')[0] ?? '' }));

      return { scoreCp: main.scoreCp, bestMove, pv: main.pv, mateIn: main.mateIn, alternatives };
    });
  }

  destroy(): void {
    this.proc.stdin!.end();
    this.proc.kill();
    this.ready = false;
  }
}

let engine: StockfishEngine | null = null;

function resolveEngine(): { bin: string; args: string[] } {
  // Prefer a native binary (downloaded by postinstall on Linux/Render) —
  // starts in milliseconds vs 10–60 s for the ASM.js build.
  const nativeBin = path.resolve(__dirname, '../bin/stockfish');
  if (require('fs').existsSync(nativeBin)) {
    return { bin: nativeBin, args: [] };
  }
  // Fall back to the ASM.JS build from the stockfish npm package.
  const asmJs = require.resolve('stockfish/bin/stockfish-18-asm.js');
  return { bin: process.execPath, args: [asmJs] };
}

let engineInitPromise: Promise<void> | null = null;

export async function initEngine(): Promise<void> {
  const { bin, args } = resolveEngine();
  const newEngine = new StockfishEngine(bin, args);
  try {
    await newEngine.init();
    engine = newEngine;
    logger.info('Stockfish engine ready (ASM.JS build)');
  } catch (err) {
    newEngine.destroy();
    engine = null;
    throw err;
  } finally {
    engineInitPromise = null;
  }
}

async function ensureEngine(): Promise<void> {
  if (engine?.ready) return;
  if (!engineInitPromise) {
    engineInitPromise = initEngine();
  }
  await engineInitPromise;
}

export async function getBestMove(fen: string, level: number): Promise<string> {
  if (!engine?.ready) throw new Error('Engine not initialised');
  return engine.getBestMove(fen, level);
}

export async function analyzePosition(fen: string, depth = 8): Promise<{
  scoreCp: number; bestMove: string; pv: string;
  mateIn: number | null;
  alternatives: Array<{ scoreCp: number; mateIn: number | null; bestMove: string; pv: string }>;
}> {
  await ensureEngine();
  return engine!.analyzePosition(fen, depth);
}

export function destroyEngine(): void {
  engine?.destroy();
  engine = null;
}

// Parse UCI move string (e.g. "e2e4" or "e7e8q") to { from, to, promotion }
export function parseUciMove(uci: string): { from: string; to: string; promotion?: string } {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length === 5 ? uci[4] : undefined;
  return { from, to, promotion };
}
