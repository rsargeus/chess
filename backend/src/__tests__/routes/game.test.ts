import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

// Configurable auth state — tests can override roles as needed
const authState = { roles: [] as string[] };

// Mock JWT middleware — injects configurable roles into every request
vi.mock('../../middleware/auth', () => ({
  jwtCheck: (req: any, _res: any, next: any) => {
    req.auth = {
      payload: {
        sub: 'test-user',
        'https://chess-api/roles': authState.roles,
      },
    };
    next();
  },
}));

// Mock Stockfish so computer moves are instant and deterministic
vi.mock('../../stockfish', () => ({
  getBestMove: vi.fn().mockResolvedValue('e7e5'),
  parseUciMove: vi.fn().mockReturnValue({ from: 'e7', to: 'e5' }),
  initEngine: vi.fn(),
  destroyEngine: vi.fn(),
}));

beforeEach(() => {
  authState.roles = [];
});

describe('POST /games', () => {
  it('creates a pvp game and returns 201', async () => {
    const res = await request(app)
      .post('/games')
      .send({ mode: 'pvp' });

    expect(res.status).toBe(201);
    expect(res.body.gameId).toBeTruthy();
    expect(res.body.status).toBe('active');
    expect(res.body.mode).toBe('pvp');
  });

  it('returns 403 for vs_computer without premium role', async () => {
    const res = await request(app)
      .post('/games')
      .send({ mode: 'vs_computer', computerLevel: 4 });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/premium/i);
  });

  it('creates a vs_computer game with premium role', async () => {
    authState.roles = ['Premium'];

    const res = await request(app)
      .post('/games')
      .send({ mode: 'vs_computer', computerLevel: 4 });

    expect(res.status).toBe(201);
    expect(res.body.mode).toBe('vs_computer');
    expect(res.body.computerLevel).toBe(4);
  });

  it('returns 400 for vs_computer with computerLevel out of range', async () => {
    authState.roles = ['Premium'];

    const res = await request(app)
      .post('/games')
      .send({ mode: 'vs_computer', computerLevel: 99 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/computerLevel/i);
  });

  it('returns 400 for vs_computer with non-integer computerLevel', async () => {
    authState.roles = ['Premium'];

    const res = await request(app)
      .post('/games')
      .send({ mode: 'vs_computer', computerLevel: 3.5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/computerLevel/i);
  });
});

describe('GET /games', () => {
  it('returns an array of games', async () => {
    await request(app).post('/games').send({ mode: 'pvp' });
    const res = await request(app).get('/games');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

describe('GET /games/:gameId', () => {
  it('returns game state with moves array', async () => {
    const created = await request(app).post('/games').send({ mode: 'pvp' });
    const gameId = created.body.gameId;

    const res = await request(app).get(`/games/${gameId}`);
    expect(res.status).toBe(200);
    expect(res.body.gameId).toBe(gameId);
    expect(Array.isArray(res.body.moves)).toBe(true);
  });

  it('returns 404 for unknown gameId', async () => {
    const res = await request(app).get('/games/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});

describe('POST /games/:gameId/moves', () => {
  it('applies a valid move and returns updated state', async () => {
    const created = await request(app).post('/games').send({ mode: 'pvp' });
    const gameId = created.body.gameId;

    const res = await request(app)
      .post(`/games/${gameId}/moves`)
      .send({ from: 'e2', to: 'e4' });

    expect(res.status).toBe(200);
    expect(res.body.move.san).toBe('e4');
    expect(res.body.fen).toBeTruthy();
  });

  it('returns 400 for an illegal move', async () => {
    const created = await request(app).post('/games').send({ mode: 'pvp' });
    const gameId = created.body.gameId;

    const res = await request(app)
      .post(`/games/${gameId}/moves`)
      .send({ from: 'e2', to: 'e5' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when from/to are missing', async () => {
    const created = await request(app).post('/games').send({ mode: 'pvp' });
    const res = await request(app)
      .post(`/games/${created.body.gameId}/moves`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('DELETE /games/:gameId', () => {
  it('resigns a game and returns 204', async () => {
    const created = await request(app).post('/games').send({ mode: 'pvp' });
    const gameId = created.body.gameId;

    const res = await request(app).delete(`/games/${gameId}`);
    expect(res.status).toBe(204);

    const game = await request(app).get(`/games/${gameId}`);
    expect(game.body.status).toBe('resigned');
  });

  it('returns 404 for unknown gameId', async () => {
    const res = await request(app).delete('/games/000000000000000000000000');
    expect(res.status).toBe(404);
  });
});
