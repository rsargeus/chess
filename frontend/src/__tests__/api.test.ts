import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, listGames, getGame, postMove, resignGame, getMe, createCheckoutSession, joinGame, undoMove, analyzePosition } from '../api';

vi.mock('../auth', () => ({
  getToken: vi.fn().mockResolvedValue('mock-token'),
  logout: vi.fn().mockResolvedValue(undefined),
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

describe('undoMove', () => {
  it('sends POST /games/:id/undo and returns updated game state', async () => {
    mockFetch.mockReturnValueOnce(mockOk(GAME_STATE));

    const result = await undoMove('abc123');

    expect(mockFetch).toHaveBeenCalledWith('/games/abc123/undo', expect.objectContaining({
      method: 'POST',
    }));
    expect(result.gameId).toBe('abc123');
  });

  it('throws with server error message on failure', async () => {
    mockFetch.mockReturnValueOnce(mockError(400, { error: 'No moves to undo' }));
    await expect(undoMove('abc123')).rejects.toThrow('No moves to undo');
  });
});

describe('joinGame', () => {
  it('sends POST /games/join/:inviteCode and returns game state', async () => {
    mockFetch.mockReturnValueOnce(mockOk(GAME_STATE));

    const result = await joinGame('abc123def456');

    expect(mockFetch).toHaveBeenCalledWith('/games/join/abc123def456', expect.objectContaining({
      method: 'POST',
    }));
    expect(result.gameId).toBe('abc123');
  });

  it('throws with server error message on failure', async () => {
    mockFetch.mockReturnValueOnce(mockError(404, { error: 'Game not found' }));
    await expect(joinGame('000000000000')).rejects.toThrow('Game not found');
  });
});

describe('getMe', () => {
  it('returns premium status', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ premium: false }));

    const result = await getMe();
    expect(result.premium).toBe(false);
  });

  it('throws and triggers logout on 404', async () => {
    const { logout } = await import('../auth');
    const mockLogout = vi.mocked(logout);

    mockFetch.mockReturnValueOnce(Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    }));

    await expect(getMe()).rejects.toThrow('User not found');
    expect(mockLogout).toHaveBeenCalled();
  });
});

describe('createCheckoutSession', () => {
  it('sends POST /checkout and returns redirect URL', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ url: 'https://checkout.stripe.com/test' }));

    const url = await createCheckoutSession();
    expect(url).toBe('https://checkout.stripe.com/test');
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.promoCode).toBeUndefined();
  });

  it('includes promoCode in body when provided', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ url: 'https://checkout.stripe.com/test' }));

    await createCheckoutSession('5KR');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.promoCode).toBe('5KR');
  });

  it('throws with server error when promo code is invalid', async () => {
    mockFetch.mockReturnValueOnce(mockError(400, { error: 'Invalid promotion code' }));
    await expect(createCheckoutSession('INVALID')).rejects.toThrow('Invalid promotion code');
  });
});

describe('analyzePosition', () => {
  it('sends POST /analyze with fen and returns analysis', async () => {
    const mockResult = {
      scoreCp: 30,
      bestMove: 'e2e4',
      bestMoveSan: 'e4',
      bestMovePosition: null,
      moveQuality: null,
      evalDropCp: null,
      mateIn: null,
      alternatives: [],
      pv: null,
      pvPositions: [],
      pvStartMoveNum: 1,
      pvStartWhite: true,
      coachMessage: 'Good move!',
    };
    mockFetch.mockReturnValueOnce(mockOk(mockResult));

    const result = await analyzePosition(INITIAL_FEN);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.fen).toBe(INITIAL_FEN);
    expect(result.bestMove).toBe('e2e4');
    expect(result.coachMessage).toBe('Good move!');
  });

  it('includes previousFen and playerMoveSan when provided', async () => {
    mockFetch.mockReturnValueOnce(mockOk({ scoreCp: 0, bestMove: 'e2e4', bestMoveSan: null, bestMovePosition: null, moveQuality: 'good', evalDropCp: 5, mateIn: null, alternatives: [], pv: null, pvPositions: [], pvStartMoveNum: 1, pvStartWhite: true, coachMessage: '' }));

    await analyzePosition('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', INITIAL_FEN, 'e4');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.previousFen).toBe(INITIAL_FEN);
    expect(body.playerMoveSan).toBe('e4');
  });
});
