declare const __WS_URL__: string;

import { getToken } from './auth';

type GameEventHandler = (event: { type: string; gameId: string }) => void;

let ws: WebSocket | null = null;
let currentGameId: string | null = null;
let handler: GameEventHandler | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsBase(): string {
  if (__WS_URL__) return __WS_URL__;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//localhost:3000`;
}

async function connect(gameId: string): Promise<void> {
  if (ws) ws.close();
  ws = new WebSocket(getWsBase());

  ws.onopen = async () => {
    try {
      const token = await getToken();
      ws!.send(JSON.stringify({ type: 'auth', token, gameId }));
    } catch {
      ws!.close(1008, 'Could not get token');
    }
  };

  ws.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data);
      handler?.(event);
    } catch {
      console.warn('[ws] Failed to parse message:', ev.data);
    }
  };

  ws.onclose = () => {
    if (currentGameId === gameId) {
      reconnectTimer = setTimeout(() => connect(gameId), 3000);
    }
  };
}

export function connectToGame(gameId: string, onEvent: GameEventHandler): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  currentGameId = gameId;
  handler = onEvent;
  connect(gameId);
}

export function disconnectFromGame(): void {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  currentGameId = null;
  handler = null;
  if (ws) { ws.close(); ws = null; }
}
