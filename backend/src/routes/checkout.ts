import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/', async (req: Request, res: Response) => {
  const userId = req.auth!.payload.sub as string;

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { userId },
    success_url: `${process.env.FRONTEND_URL}?payment=success`,
    cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`,
  });

  res.json({ url: session.url });
});

export default router;
