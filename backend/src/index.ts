import { app } from './app';
import { connectDB } from './db';
import { initEngine, destroyEngine } from './stockfish';
import { initWebSocketServer } from './wsServer';
import logger from './logger';

const REQUIRED_ENV = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'MONGODB_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  logger.fatal({ missing }, 'Missing required environment variables');
  process.exit(1);
}

const PORT = process.env.PORT ?? 3000;

async function start() {
  await connectDB();
  try {
    await initEngine();
  } catch (err) {
    logger.warn({ err }, 'Stockfish not available — computer mode will use random moves');
  }
  const server = app.listen(PORT, () => logger.info({ port: PORT }, 'Backend running'));
  initWebSocketServer(server);
  process.on('SIGTERM', () => { destroyEngine(); server.close(); });
  process.on('SIGINT',  () => { destroyEngine(); server.close(); });
}

start().catch((err) => {
  logger.fatal({ err }, 'Startup failed');
  process.exit(1);
});
