import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';
import { UserProfile } from '../../models/UserProfile';

vi.mock('../../middleware/auth', () => ({
  jwtCheck: (req: any, _res: any, next: any) => {
    req.auth = { payload: { sub: 'test-user' } };
    next();
  },
}));

vi.mock('../../auth0Management', () => ({
  getUserRoles: vi.fn(),
  invalidateRolesCache: vi.fn(),
}));

import { getUserRoles } from '../../auth0Management';
const mockGetUserRoles = vi.mocked(getUserRoles);

beforeEach(() => {
  mockGetUserRoles.mockReset();
});

// ─── GET /me ─────────────────────────────────────────────────────────────────

describe('GET /me', () => {
  it('returns premium: false when user has no premium role', async () => {
    mockGetUserRoles.mockResolvedValue([]);

    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(false);
  });

  it('returns premium: false when user has role but no premiumExpiresAt', async () => {
    mockGetUserRoles.mockResolvedValue(['premium']);

    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(false);
  });

  it('returns premium: false when premiumExpiresAt is in the past', async () => {
    mockGetUserRoles.mockResolvedValue(['premium']);
    const expired = new Date(Date.now() - 1000);
    await UserProfile.create({ userId: 'test-user', premiumExpiresAt: expired });

    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(false);
  });

  it('returns premium: true with expiry when role + valid premiumExpiresAt', async () => {
    mockGetUserRoles.mockResolvedValue(['premium']);
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365);
    await UserProfile.create({ userId: 'test-user', premiumExpiresAt: future });

    const res = await request(app).get('/me');
    expect(res.status).toBe(200);
    expect(res.body.premium).toBe(true);
    expect(res.body.premiumExpiresAt).toBeTruthy();
  });

  it('returns 404 when Auth0 reports user does not exist', async () => {
    mockGetUserRoles.mockRejectedValue(new Error('Auth0 get roles failed: inexistent_user'));

    const res = await request(app).get('/me');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('returns 503 when Auth0 management API fails', async () => {
    mockGetUserRoles.mockRejectedValue(new Error('Auth0 management API unreachable'));

    const res = await request(app).get('/me');
    expect(res.status).toBe(503);
  });
});

// ─── GET /me/profile ─────────────────────────────────────────────────────────

describe('GET /me/profile', () => {
  it('returns null when no profile exists', async () => {
    const res = await request(app).get('/me/profile');
    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('returns profile when it exists', async () => {
    await UserProfile.create({ userId: 'test-user', displayName: 'Magnus', piece: 'queen', color: 'brown' });

    const res = await request(app).get('/me/profile');
    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Magnus');
    expect(res.body.piece).toBe('queen');
    expect(res.body.color).toBe('brown');
  });
});

// ─── PUT /me/profile ─────────────────────────────────────────────────────────

describe('PUT /me/profile', () => {
  it('creates and returns profile', async () => {
    const res = await request(app)
      .put('/me/profile')
      .send({ displayName: 'Magnus', piece: 'knight', color: 'green' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('Magnus');
    expect(res.body.piece).toBe('knight');
    expect(res.body.color).toBe('green');
  });

  it('returns 400 when displayName exceeds 30 characters', async () => {
    const res = await request(app)
      .put('/me/profile')
      .send({ displayName: 'a'.repeat(31) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/30/);
  });

  it('returns 400 for invalid piece', async () => {
    const res = await request(app)
      .put('/me/profile')
      .send({ piece: 'dragon' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/piece/i);
  });

  it('returns 400 for invalid color', async () => {
    const res = await request(app)
      .put('/me/profile')
      .send({ color: 'hotpink' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/color/i);
  });

  it('updates existing profile', async () => {
    await UserProfile.create({ userId: 'test-user', displayName: 'Old', piece: 'pawn', color: 'navy' });

    const res = await request(app)
      .put('/me/profile')
      .send({ displayName: 'New', piece: 'rook', color: 'teal' });

    expect(res.status).toBe(200);
    expect(res.body.displayName).toBe('New');
    expect(res.body.piece).toBe('rook');
  });
});
