import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './db';
import gameRouter from './routes/game';
import { jwtCheck } from './middleware/auth';
import { initEngine, destroyEngine } from './stockfish';
import { openApiSpec } from './openapi';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
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
app.use('/games', jwtCheck, gameRouter);

async function start() {
  await connectDB();
  try {
    await initEngine();
  } catch (err) {
    console.warn('Stockfish not available — computer mode will use random moves:', err);
  }
  const server = app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  process.on('SIGTERM', () => { destroyEngine(); server.close(); });
  process.on('SIGINT',  () => { destroyEngine(); server.close(); });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
