import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createGame, listGames, getGame, applyMove, resignGame } from '../gameStore';

vi.mock('../stockfish', () => ({
  getBestMove: vi.fn().mockResolvedValue('e7e5'),
  parseUciMove: vi.fn().mockReturnValue({ from: 'e7', to: 'e5' }),
}));

const USER = 'user-1';
const OTHER_USER = 'user-2';

describe('createGame', () => {
  it('returns initial game state with starting FEN', async () => {
    const game = await createGame(USER, 'pvp');
    expect(game.gameId).toBeTruthy();
    expect(game.fen).toContain('rnbqkbnr');
    expect(game.status).toBe('active');
    expect(game.turn).toBe('w');
    expect(game.mode).toBe('pvp');
  });

  it('sets computerLevel for vs_computer games', async () => {
    const game = await createGame(USER, 'vs_computer', 3);
    expect(game.mode).toBe('vs_computer');
    expect(game.computerLevel).toBe(3);
  });

  it('defaults computerLevel to 5 if not provided', async () => {
    const game = await createGame(USER, 'vs_computer');
    expect(game.computerLevel).toBe(5);
  });
});

describe('listGames', () => {
  it('returns only games belonging to the user', async () => {
    await createGame(USER, 'pvp');
    await createGame(OTHER_USER, 'pvp');

    const games = await listGames(USER);
    expect(games).toHaveLength(1);
  });

  it('returns games most recent first', async () => {
    await createGame(USER, 'pvp');
    await createGame(USER, 'vs_computer', 5);

    const games = await listGames(USER);
    expect(games[0].mode).toBe('vs_computer');
  });

  it('includes move count', async () => {
    const game = await createGame(USER, 'pvp');
    await applyMove(game.gameId, 'e2', 'e4', USER);

    const games = await listGames(USER);
    expect(games[0].moveCount).toBe(1);
  });
});

describe('getGame', () => {
  it('returns game with moves', async () => {
    const created = await createGame(USER, 'pvp');
    await applyMove(created.gameId, 'e2', 'e4', USER);

    const game = await getGame(created.gameId, USER);
    expect(game).not.toBeNull();
    expect(game!.moves).toHaveLength(1);
    expect(game!.moves[0].san).toBe('e4');
  });

  it('returns null for wrong user', async () => {
    const created = await createGame(USER, 'pvp');
    const game = await getGame(created.gameId, OTHER_USER);
    expect(game).toBeNull();
  });
});

describe('applyMove', () => {
  it('applies a valid move and returns updated FEN', async () => {
    const created = await createGame(USER, 'pvp');
    const result = await applyMove(created.gameId, 'e2', 'e4', USER);

    expect('error' in result).toBe(false);
    if (!('error' in result)) {
      expect(result.move.san).toBe('e4');
      expect(result.fen).not.toBe(created.fen);
      expect(result.status).toBe('active');
    }
  });

  it('returns error for an illegal move', async () => {
    const created = await createGame(USER, 'pvp');
    const result = await applyMove(created.gameId, 'e2', 'e5', USER);

    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.status).toBe(400);
    }
  });

  it('returns error when game is already over', async () => {
    const created = await createGame(USER, 'pvp');
    await resignGame(created.gameId, USER);

    const result = await applyMove(created.gameId, 'e2', 'e4', USER);
    expect('error' in result).toBe(true);
  });

  it('returns error for wrong user', async () => {
    const created = await createGame(USER, 'pvp');
    const result = await applyMove(created.gameId, 'e2', 'e4', OTHER_USER);
    expect('error' in result).toBe(true);
  });
});

describe('resignGame', () => {
  it('sets game status to resigned', async () => {
    const created = await createGame(USER, 'pvp');
    const ok = await resignGame(created.gameId, USER);
    expect(ok).toBe(true);

    const game = await getGame(created.gameId, USER);
    expect(game!.status).toBe('resigned');
  });

  it('returns false for non-existent game', async () => {
    const ok = await resignGame('000000000000000000000000', USER);
    expect(ok).toBe(false);
  });
});
