import { Router, Request, Response } from 'express';
import { getUserRoles } from '../auth0Management';
import { UserProfile } from '../models/UserProfile';

const meRouter = Router();

meRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.auth!.payload.sub as string;
  try {
    const roles = await getUserRoles(userId);
    res.json({ premium: roles.includes('premium') });
  } catch (err) {
    console.error('GET /me error:', err);
    res.status(500).json({ error: 'Failed to fetch user info' });
  }
});

meRouter.get('/profile', async (req: Request, res: Response) => {
  const userId = req.auth!.payload.sub as string;
  try {
    const profile = await UserProfile.findOne({ userId });
    res.json(profile ? {
      displayName: profile.displayName,
      piece: profile.piece,
      color: profile.color,
    } : null);
  } catch (err) {
    console.error('GET /me/profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

meRouter.put('/profile', async (req: Request, res: Response) => {
  const userId = req.auth!.payload.sub as string;
  const { displayName, piece, color } = req.body;
  const allowed = { piece: ['king','queen','rook','bishop','knight','pawn'], color: ['brown','green','navy','purple','forest','wine','teal','slate'] };
  if (piece && !allowed.piece.includes(piece)) { res.status(400).json({ error: 'Invalid piece' }); return; }
  if (color && !allowed.color.includes(color)) { res.status(400).json({ error: 'Invalid color' }); return; }
  try {
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { displayName: displayName ?? '', piece: piece ?? 'queen', color: color ?? 'brown' },
      { upsert: true, new: true }
    );
    res.json({ displayName: profile.displayName, piece: profile.piece, color: profile.color });
  } catch (err) {
    console.error('PUT /me/profile error:', err);
    res.status(500).json({ error: 'Failed to save profile' });
  }
});

export default meRouter;
