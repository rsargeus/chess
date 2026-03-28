import { Router, Request, Response } from 'express';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/', async (req: Request, res: Response) => {
  const userId = req.auth!.payload.sub as string;
  const { promoCode } = req.body as { promoCode?: string };

  let discounts: { promotion_code: string }[] | undefined;
  if (promoCode) {
    const codes = await stripe.promotionCodes.list({ code: promoCode, active: true, limit: 1 });
    if (codes.data.length === 0) {
      res.status(400).json({ error: 'Invalid promotion code' });
      return;
    }
    discounts = [{ promotion_code: codes.data[0].id }];
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    ...(discounts ? { discounts } : { allow_promotion_codes: true }),
    metadata: { userId },
    success_url: `${process.env.FRONTEND_URL}?payment=success`,
    cancel_url: `${process.env.FRONTEND_URL}?payment=cancelled`,
  });

  res.json({ url: session.url });
});

export default router;
