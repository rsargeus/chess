import { getToken } from './auth';

declare const __BACKEND_URL__: string;
const API_BASE = __BACKEND_URL__ || '';
const BASE = `${API_BASE}/games`;

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return { Authorization: `Bearer ${token}` };
}

export type GameMode = 'pvp' | 'vs_computer';

export interface GameSummary {
  gameId: string;
  status: string;
  mode: GameMode;
  computerLevel: number | null;
  createdAt: string;
  moveCount: number;
  playerColor: 'w' | 'b' | null;
  waitingForOpponent: boolean;
  turn: 'w' | 'b';
}

export interface MoveRecord {
  moveNumber: number;
  from: string;
  to: string;
  san: string;
  fenAfter: string;
  playedAt: string;
}

export interface GameState {
  gameId: string;
  fen: string;
  turn: 'w' | 'b';
  status: string;
  mode: GameMode;
  computerLevel: number | null;
  inviteCode: string | null;
  playerColor: 'w' | 'b' | null;
  waitingForOpponent: boolean;
  moves: MoveRecord[];
}

export interface MoveResult {
  fen: string;
  turn: 'w' | 'b';
  status: string;
  move: { moveNumber: number; san: string; fenAfter: string };
  computerMove: { san: string; from: string; to: string } | null;
}

export async function createGame(mode: GameMode, computerLevel?: number): Promise<GameState> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ mode, computerLevel }),
  });
  if (!res.ok) throw new Error('Failed to create game');
  return res.json();
}

function handleUnauthorized(res: Response): void {
  if (res.status === 401) {
    // Token expired or revoked — reload to re-authenticate
    window.location.reload();
  }
}

export async function listGames(): Promise<GameSummary[]> {
  const res = await fetch(BASE, { headers: await authHeaders() });
  if (!res.ok) { handleUnauthorized(res); throw new Error('Failed to list games'); }
  return res.json();
}

export async function getGame(gameId: string): Promise<GameState> {
  const res = await fetch(`${BASE}/${gameId}`, { headers: await authHeaders() });
  if (!res.ok) { handleUnauthorized(res); throw new Error('Failed to get game'); }
  return res.json();
}

export async function postMove(gameId: string, from: string, to: string): Promise<MoveResult> {
  const res = await fetch(`${BASE}/${gameId}/moves`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify({ from, to }),
  });
  const data = await res.json();
  if (!res.ok) { handleUnauthorized(res); throw new Error(data.error ?? 'Invalid move'); }
  return data;
}

export async function resignGame(gameId: string): Promise<void> {
  await fetch(`${BASE}/${gameId}`, { method: 'DELETE', headers: await authHeaders() });
}

export async function joinGame(inviteCode: string): Promise<GameState> {
  const res = await fetch(`${BASE}/join/${inviteCode}`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? 'Failed to join game');
  }
  return res.json();
}

export async function pingBackend(): Promise<void> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error('backend not ready');
  const data = await res.json() as { ok?: boolean }; // throws if HTML returned (SPA fallback)
  if (!data.ok) throw new Error('backend not ready');
}

export async function getMe(): Promise<{ premium: boolean }> {
  const res = await fetch(`${API_BASE}/me`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch user info');
  return res.json();
}

export interface UserProfileData { displayName: string; piece: string; color: string; }

export async function getProfile(): Promise<UserProfileData | null> {
  const res = await fetch(`${API_BASE}/me/profile`, { headers: await authHeaders() });
  if (!res.ok) return null;
  return res.json();
}

export async function saveProfile(data: UserProfileData): Promise<UserProfileData> {
  const res = await fetch(`${API_BASE}/me/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...await authHeaders() },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save profile');
  return res.json();
}

export async function createCheckoutSession(): Promise<string> {
  const res = await fetch(`${API_BASE}/checkout`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) throw new Error('Failed to create checkout session');
  const data = await res.json() as { url: string };
  return data.url;
}
