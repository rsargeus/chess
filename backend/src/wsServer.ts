import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Game } from './models/Game';

// gameId → connected sockets
const rooms = new Map<string, Set<WebSocket>>();

// Per-IP failed auth tracking to prevent connection spam
const failedAuthByIp = new Map<string, { count: number; resetAt: number }>();
const MAX_FAILED_AUTH = 10;
const FAILED_AUTH_WINDOW_MS = 60_000;

function recordFailedAuth(ip: string): boolean {
  const now = Date.now();
  const entry = failedAuthByIp.get(ip);
  if (!entry || entry.resetAt < now) {
    failedAuthByIp.set(ip, { count: 1, resetAt: now + FAILED_AUTH_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_FAILED_AUTH;
}

const JWKS = createRemoteJWKSet(
  new URL(`https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`)
);

async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      audience: process.env.AUTH0_AUDIENCE,
    });
    return (payload.sub as string) ?? null;
  } catch {
    return null;
  }
}

function canAccess(game: { userId: string; whiteUserId: string | null; blackUserId: string | null }, userId: string): boolean {
  return game.userId === userId || game.whiteUserId === userId || game.blackUserId === userId;
}

function addToRoom(gameId: string, ws: WebSocket): void {
  if (!rooms.has(gameId)) rooms.set(gameId, new Set());
  rooms.get(gameId)!.add(ws);
  ws.on('close', () => {
    rooms.get(gameId)?.delete(ws);
    if (rooms.get(gameId)?.size === 0) rooms.delete(gameId);
  });
}

export function initWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const ip = req.socket.remoteAddress ?? 'unknown';

    if (recordFailedAuth(ip)) {
      ws.close(1008, 'Too many failed attempts');
      return;
    }

    // Expect first message: { type: 'auth', token: JWT, gameId: string }
    const authTimeout = setTimeout(() => ws.close(1008, 'Auth timeout'), 5000);

    ws.once('message', async (data) => {
      clearTimeout(authTimeout);
      try {
        const { token, gameId } = JSON.parse(data.toString());
        if (!token || !gameId) {
          recordFailedAuth(ip);
          ws.close(1008, 'token and gameId required');
          return;
        }

        const userId = await verifyToken(token);
        if (!userId) {
          recordFailedAuth(ip);
          ws.close(1008, 'Invalid token');
          return;
        }

        const game = await Game.findById(gameId).lean();
        if (!game || !canAccess(game, userId)) {
          recordFailedAuth(ip);
          ws.close(1008, 'Access denied');
          return;
        }

        addToRoom(gameId, ws);
        (ws as any).isAlive = true;
        ws.on('pong', () => { (ws as any).isAlive = true; });
        // Close connection after 1 hour to force token re-validation
        setTimeout(() => ws.close(1001, 'Session expired'), 60 * 60 * 1000);
      } catch {
        recordFailedAuth(ip);
        ws.close(1008, 'Auth failed');
      }
    });
  });

  // Ping all clients every 30s, drop dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) { ws.terminate(); return; }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => {
    clearInterval(interval);
    rooms.clear();
    failedAuthByIp.clear();
  });
}

export function broadcastToGame(gameId: string, event: object): void {
  const sockets = rooms.get(gameId);
  if (!sockets) return;
  const msg = JSON.stringify(event);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}
