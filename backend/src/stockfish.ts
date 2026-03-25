import { spawn, ChildProcess } from 'child_process';
import path from 'path';

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
  private ready = false;

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
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.send('stop');
        reject(new Error(`Stockfish timeout waiting for response`));
      }, timeoutMs);
      this.listeners.push((line) => {
        if (pred(line)) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(line);
          }
          return true;
        }
        return false;
      });
    });
  }

  async init(): Promise<void> {
    this.send('uci');
    await this.waitFor(l => l === 'uciok');
    this.send('isready');
    await this.waitFor(l => l === 'readyok');
    this.ready = true;
  }

  async getBestMove(fen: string, level: number): Promise<string> {
    if (!this.ready) throw new Error('Engine not initialised');
    const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG[5];

    this.send('ucinewgame');
    this.send('isready');
    await this.waitFor(l => l === 'readyok');

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
    return move; // UCI format e.g. "e7e5" or "e7e8q"
  }

  destroy(): void {
    this.proc.stdin!.end();
    this.proc.kill();
    this.ready = false;
  }
}

let engine: StockfishEngine | null = null;

function resolveEngine(): { bin: string; args: string[] } {
  // Use the ASM.JS build from the stockfish npm package — works in any Node.js
  // without WASM threading restrictions, communicates via stdin/stdout like a native binary.
  const asmJs = require.resolve('stockfish/bin/stockfish-18-asm.js');
  return { bin: process.execPath, args: [asmJs] };
}

export async function initEngine(): Promise<void> {
  const { bin, args } = resolveEngine();
  engine = new StockfishEngine(bin, args);
  await engine.init();
  console.log('Stockfish engine ready (ASM.JS build)');
}

export async function getBestMove(fen: string, level: number): Promise<string> {
  if (!engine) throw new Error('Engine not initialised — call initEngine() first');
  return engine.getBestMove(fen, level);
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
