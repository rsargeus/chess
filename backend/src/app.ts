import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import pinoHttp from 'pino-http';
import gameRouter from './routes/game';
import checkoutRouter from './routes/checkout';
import webhookRouter from './routes/webhook';
import meRouter from './routes/me';
import analyzeRouter from './routes/analyze';
import { jwtCheck } from './middleware/auth';
import { openApiSpec } from './openapi';
import logger from './logger';

export const app = express();

const corsOrigin = process.env.FRONTEND_URL;
if (!corsOrigin) {
  logger.fatal('FRONTEND_URL environment variable is not set — refusing to start with wildcard CORS');
  process.exit(1);
}
app.use(cors({ origin: corsOrigin }));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'", `https://${process.env.AUTH0_DOMAIN}`],
    },
  },
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

// Stricter limit for /analyze — each request invokes Stockfish + Groq
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analysis requests, please slow down' },
});
// HTTP request logging (skip /health; allowlist safe headers only)
app.use(pinoHttp({
  logger,
  autoLogging: { ignore: (req) => req.url === '/health' },
  serializers: {
    req(req) {
      return {
        method: req.method,
        url: req.url,
        headers: {
          'content-type': req.headers['content-type'],
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': req.headers['x-forwarded-for'],
        },
      };
    },
  },
}));

// Health check is exempt from rate limiting (used for backend wake-up probing)
app.get('/health', (_req, res) => res.json({ ok: true }));

app.use(apiLimiter);

// Webhook must use raw body BEFORE express.json() for Stripe signature verification
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }), webhookRouter);

app.use(express.json());

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  swaggerOptions: {
    oauth2RedirectUrl: `${process.env.BACKEND_URL ?? 'http://localhost:3000'}/api-docs/oauth2-redirect.html`,
    oauth: {
      clientId: process.env.AUTH0_CLIENT_ID,
      additionalQueryStringParams: { audience: process.env.AUTH0_AUDIENCE },
      usePkceWithAuthorizationCodeGrant: true,
    },
  },
};

// Only expose API docs in non-production environments
if (process.env.NODE_ENV !== 'production') {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, swaggerUiOptions));
}
app.use('/me', jwtCheck, meRouter);
app.use('/checkout', jwtCheck, checkoutRouter);
app.use('/games', jwtCheck, gameRouter);
app.use('/analyze', analyzeLimiter, jwtCheck, analyzeRouter);
