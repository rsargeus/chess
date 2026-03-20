import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, listGames, getGame, postMove, resignGame } from '../api';

vi.mock('../auth', () => ({
  getToken: vi.fn().mockResolvedValue('mock-token'),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const GAME_STATE = {
  gameId: 'abc123',
  fen: INITIAL_FEN,
  turn: 'w' as const,
  status: 'active',
  mode: 'pvp' as const,
  computerLevel: null,
  moves: [],
};

function mockOk(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
}

function mockError(status: number, body: unknown) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve(body) });
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('createGame', () => {
  it('sends POST /games with Authorization header', async () => {
    mockFetch.mockReturnValueOnce(mockOk(GAME_STATE));

    await createGame('pvp');

    expect(mockFetch).toHaveBeenCalledWith('/games', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
    }));
  });

  it('includes computerLevel in body when provided', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ ...GAME_STATE, mode: 'vs_computer', computerLevel: 5 }));

    await createGame('vs_computer', 5);

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body.computerLevel).toBe(5);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(mockError(500, {}));
    await expect(createGame('pvp')).rejects.toThrow('Failed to create game');
  });
});

describe('listGames', () => {
  it('sends GET /games with Authorization header', async () => {
    mockFetch.mockReturnValueOnce(mockOk([]));

    await listGames();

    expect(mockFetch).toHaveBeenCalledWith('/games', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
    }));
  });
});

describe('getGame', () => {
  it('sends GET /games/:id', async () => {
    mockFetch.mockReturnValueOnce(mockOk(GAME_STATE));

    await getGame('abc123');

    expect(mockFetch).toHaveBeenCalledWith('/games/abc123', expect.anything());
  });
});

describe('postMove', () => {
  it('sends POST /games/:id/moves with from and to', async () => {
    const moveResult = {
      fen: INITIAL_FEN,
      turn: 'b' as const,
      status: 'active',
      move: { moveNumber: 1, san: 'e4', fenAfter: INITIAL_FEN },
      computerMove: null,
    };
    mockFetch.mockReturnValueOnce(mockOk(moveResult));

    await postMove('abc123', 'e2', 'e4');

    const call = mockFetch.mock.calls[0];
    const body = JSON.parse(call[1].body);
    expect(body).toEqual({ from: 'e2', to: 'e4' });
    expect(call[0]).toBe('/games/abc123/moves');
  });

  it('throws with server error message on bad move', async () => {
    mockFetch.mockReturnValueOnce(mockError(400, { error: 'Invalid move' }));
    await expect(postMove('abc123', 'e2', 'e5')).rejects.toThrow('Invalid move');
  });
});

describe('resignGame', () => {
  it('sends DELETE /games/:id', async () => {
    mockFetch.mockReturnValueOnce(Promise.resolve({ ok: true }));

    await resignGame('abc123');

    expect(mockFetch).toHaveBeenCalledWith('/games/abc123', expect.objectContaining({
      method: 'DELETE',
    }));
  });
});
