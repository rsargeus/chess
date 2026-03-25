import { app } from './app';
import { connectDB } from './db';
import { initEngine, destroyEngine } from './stockfish';
import { initWebSocketServer } from './wsServer';

const REQUIRED_ENV = ['AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'MONGODB_URI'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = process.env.PORT ?? 3000;

async function start() {
  await connectDB();
  try {
    await initEngine();
  } catch (err) {
    console.warn('Stockfish not available — computer mode will use random moves:', err);
  }
  const server = app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
  initWebSocketServer(server);
  process.on('SIGTERM', () => { destroyEngine(); server.close(); });
  process.on('SIGINT',  () => { destroyEngine(); server.close(); });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});
