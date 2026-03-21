import { Router, Request, Response } from 'express';
import * as store from '../gameStore';

const router = Router();

function userId(req: Request): string {
  return req.auth!.payload.sub as string;
}

router.post('/', async (req: Request, res: Response) => {
  const mode = req.body.mode === 'vs_computer' ? 'vs_computer' : 'pvp';
  if (mode === 'vs_computer') {
    const roles = ((req.auth!.payload['https://chess-api/roles'] as string[]) ?? []).map(r => r.toLowerCase());
    if (!roles.includes('premium')) {
      return res.status(403).json({ error: 'Premium membership required to play vs Computer' });
    }
  }
  const rawLevel = req.body.computerLevel;
  if (mode === 'vs_computer' && (typeof rawLevel !== 'number' || rawLevel < 1 || rawLevel > 10 || !Number.isInteger(rawLevel))) {
    return res.status(400).json({ error: 'computerLevel must be an integer between 1 and 10' });
  }
  const level = mode === 'vs_computer' ? rawLevel : null;
  const game = await store.createGame(userId(req), mode, level);
  res.status(201).json(game);
});

router.get('/', async (req: Request, res: Response) => {
  const games = await store.listGames(userId(req));
  res.json(games);
});

router.get('/:gameId', async (req: Request, res: Response) => {
  const game = await store.getGame(req.params.gameId, userId(req));
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

router.post('/:gameId/moves', async (req: Request, res: Response) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });
  const result = await store.applyMove(req.params.gameId, from, to, userId(req));
  if ('error' in result) return res.status(result.status as number).json({ error: result.error });
  res.json(result);
});

router.delete('/:gameId', async (req: Request, res: Response) => {
  const ok = await store.resignGame(req.params.gameId, userId(req));
  if (!ok) return res.status(404).json({ error: 'Game not found' });
  res.status(204).send();
});

export default router;
