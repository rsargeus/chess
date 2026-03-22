import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';

// gameId → connected sockets
const rooms = new Map<string, Set<WebSocket>>();

export function initWebSocketServer(server: Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? '', 'http://localhost');
    const gameId = url.searchParams.get('gameId');
    if (!gameId) { ws.close(1008, 'gameId required'); return; }

    if (!rooms.has(gameId)) rooms.set(gameId, new Set());
    rooms.get(gameId)!.add(ws);

    ws.on('close', () => {
      rooms.get(gameId)?.delete(ws);
      if (rooms.get(gameId)?.size === 0) rooms.delete(gameId);
    });

    // Keep-alive pings
    ws.on('pong', () => { (ws as any).isAlive = true; });
    (ws as any).isAlive = true;
  });

  // Ping all clients every 30s, drop dead connections
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) { ws.terminate(); return; }
      (ws as any).isAlive = false;
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => clearInterval(interval));
}

export function broadcastToGame(gameId: string, event: object): void {
  const sockets = rooms.get(gameId);
  if (!sockets) return;
  const msg = JSON.stringify(event);
  sockets.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  });
}
