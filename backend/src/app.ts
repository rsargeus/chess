import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import gameRouter from './routes/game';
import checkoutRouter from './routes/checkout';
import webhookRouter from './routes/webhook';
import { jwtCheck } from './middleware/auth';
import { openApiSpec } from './openapi';

export const app = express();

const corsOrigin = process.env.FRONTEND_URL ?? '*';
app.use(cors({ origin: corsOrigin }));

// Webhook must use raw body BEFORE express.json() for Stripe signature verification
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json());

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  swaggerOptions: {
    oauth2RedirectUrl: 'http://localhost:3000/api-docs/oauth2-redirect.html',
    oauth: {
      clientId: process.env.AUTH0_CLIENT_ID,
      additionalQueryStringParams: { audience: process.env.AUTH0_AUDIENCE },
      usePkceWithAuthorizationCodeGrant: true,
    },
  },
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
app.use('/checkout', jwtCheck, checkoutRouter);
app.use('/games', jwtCheck, gameRouter);
