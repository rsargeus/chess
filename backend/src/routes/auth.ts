import { Router, Request, Response } from 'express';

const router = Router();

router.post('/token', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const resp = await fetch(`https://${process.env.AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'password',
      username: email,
      password,
      audience: process.env.AUTH0_AUDIENCE,
      client_id: process.env.AUTH0_CLIENT_ID,
      scope: 'openid profile email',
    }),
  });

  const data = await resp.json() as Record<string, unknown>;
  if (!resp.ok) {
    return res.status(401).json({ error: (data.error_description ?? data.error) as string });
  }

  res.json({ access_token: data.access_token, token_type: 'Bearer' });
});

export default router;
