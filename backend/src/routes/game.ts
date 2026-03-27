import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import * as store from '../gameStore';
import { broadcastToGame } from '../wsServer';

function validObjectId(id: string): boolean {
  return mongoose.Types.ObjectId.isValid(id);
}

function safeHttpStatus(status: unknown): number {
  return typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 600
    ? status : 500;
}

const router = Router();

function userId(req: Request): string {
  return req.auth!.payload.sub as string;
}

router.post('/', async (req: Request, res: Response) => {
  const { mode: rawMode, computerLevel: rawLevel } = req.body;
  const mode = rawMode === 'vs_computer' ? 'vs_computer' : rawMode === 'multiplayer' ? 'multiplayer' : 'pvp';

  if (mode === 'vs_computer') {
    const roles = ((req.auth!.payload['https://chess-api/roles'] as string[]) ?? []).map(r => r.toLowerCase());
    if (!roles.includes('premium')) {
      return res.status(403).json({ error: 'Premium membership required to play vs Computer' });
    }
    if (typeof rawLevel !== 'number' || rawLevel < 1 || rawLevel > 10 || !Number.isInteger(rawLevel)) {
      return res.status(400).json({ error: 'computerLevel must be an integer between 1 and 10' });
    }
  }

  const level = mode === 'vs_computer' ? rawLevel : null;
  const game = await store.createGame(userId(req), mode, level);
  res.status(201).json(game);
});

router.post('/join/:inviteCode', async (req: Request, res: Response) => {
  if (!/^[0-9a-f]{12}$/.test(req.params.inviteCode)) {
    return res.status(400).json({ error: 'Invalid invite code' });
  }
  const result = await store.joinGame(req.params.inviteCode, userId(req));
  if ('error' in result) return res.status(safeHttpStatus(result.status)).json({ error: result.error });
  broadcastToGame(result.gameId, { type: 'opponent_joined', gameId: result.gameId });
  res.json(result);
});

router.get('/', async (req: Request, res: Response) => {
  const games = await store.listGames(userId(req));
  res.json(games);
});

router.get('/:gameId', async (req: Request, res: Response) => {
  if (!validObjectId(req.params.gameId)) return res.status(400).json({ error: 'Invalid game ID' });
  const game = await store.getGame(req.params.gameId, userId(req));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

router.post('/:gameId/moves', async (req: Request, res: Response) => {
  if (!validObjectId(req.params.gameId)) return res.status(400).json({ error: 'Invalid game ID' });
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  if (!/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) {
    return res.status(400).json({ error: 'Invalid move coordinates' });
  }
  const result = await store.applyMove(req.params.gameId, from, to, userId(req));
  if ('error' in result) return res.status(safeHttpStatus(result.status)).json({ error: result.error });
  broadcastToGame(req.params.gameId, { type: 'move', gameId: req.params.gameId });
  res.status(200).json(result);
});

router.post('/:gameId/undo', async (req: Request, res: Response) => {
  if (!validObjectId(req.params.gameId)) return res.status(400).json({ error: 'Invalid game ID' });
  const result = await store.undoMove(req.params.gameId, userId(req));
  if ('error' in result) return res.status(safeHttpStatus(result.status)).json({ error: result.error });
  res.json(result);
});

router.delete('/:gameId', async (req: Request, res: Response) => {
  if (!validObjectId(req.params.gameId)) return res.status(400).json({ error: 'Invalid game ID' });
  const ok = await store.resignGame(req.params.gameId, userId(req));
  if (!ok) return res.status(404).json({ error: 'Game not found' });
  broadcastToGame(req.params.gameId, { type: 'resigned', gameId: req.params.gameId });
  res.status(204).send();
});

export default router;
