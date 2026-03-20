import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { connectDB } from './db';
import gameRouter from './routes/game';
import authRouter from './routes/auth';
import { jwtCheck } from './middleware/auth';
import { initEngine, destroyEngine } from './stockfish';
import { openApiSpec } from './openapi';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
app.use('/auth', authRouter);
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
