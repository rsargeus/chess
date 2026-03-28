import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { assignPremiumRole, invalidateRolesCache } from '../auth0Management';
import { UserProfile } from '../models/UserProfile';
import logger from '../logger';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Stripe webhook signature verification failed');
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;

    if (!userId) {
      logger.error({ sessionId: session.id }, 'Stripe webhook missing userId in session metadata');
      return res.status(400).json({ error: 'Missing userId in session metadata' });
    }

    try {
      const premiumExpiresAt = new Date();
      premiumExpiresAt.setFullYear(premiumExpiresAt.getFullYear() + 1);

      await Promise.all([
        assignPremiumRole(userId),
        UserProfile.findOneAndUpdate(
          { userId },
          { premiumExpiresAt },
          { upsert: true }
        ),
      ]);
      invalidateRolesCache(userId);
      logger.info({ userId, sessionId: session.id, premiumExpiresAt }, 'Premium role assigned');
    } catch (err) {
      logger.error({ err, userId }, 'Failed to assign premium role');
      // Return 500 so Stripe retries the webhook delivery
      return res.status(500).json({ error: 'Failed to assign premium role' });
    }
  }

  res.json({ received: true });
});

export default router;
