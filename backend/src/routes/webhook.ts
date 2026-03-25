import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { assignPremiumRole, invalidateRolesCache } from '../auth0Management';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error('Stripe webhook signature error:', err.message);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId) {
      try {
        await assignPremiumRole(userId);
        invalidateRolesCache(userId);
        console.log(`Premium role assigned to ${userId}`);
      } catch (err) {
        console.error('Failed to assign premium role:', err);
        // Return 500 so Stripe retries the webhook delivery
        return res.status(500).json({ error: 'Failed to assign premium role' });
      }
    }
  }

  res.json({ received: true });
});

export default router;
