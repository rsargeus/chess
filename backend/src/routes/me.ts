import { Router, Request, Response } from 'express';
import { getUserRoles } from '../auth0Management';

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

export default meRouter;
