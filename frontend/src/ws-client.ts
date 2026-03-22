declare const __WS_URL__: string;

type GameEventHandler = (event: { type: string; gameId: string }) => void;

let ws: WebSocket | null = null;
let currentGameId: string | null = null;
let handler: GameEventHandler | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function getWsBase(): string {
  if (__WS_URL__) return __WS_URL__;
  // Derive from current location in dev (ws://localhost:3000)
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//localhost:3000`;
}

function connect(gameId: string): void {
  if (ws) ws.close();
  ws = new WebSocket(`${getWsBase()}?gameId=${gameId}`);

  ws.onmessage = (ev) => {
    try {
      const event = JSON.parse(ev.data);
      handler?.(event);
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    // Auto-reconnect after 3s if we still care about this game
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
