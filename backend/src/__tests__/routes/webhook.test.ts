import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

vi.mock('../../auth0Management', () => ({
  assignPremiumRole: vi.fn().mockResolvedValue(undefined),
  invalidateRolesCache: vi.fn(),
  getUserRoles: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../models/UserProfile', () => ({
  UserProfile: {
    findOneAndUpdate: vi.fn().mockResolvedValue({}),
    findOne: vi.fn().mockResolvedValue(null),
  },
}));

import { assignPremiumRole } from '../../auth0Management';
import { UserProfile } from '../../models/UserProfile';
const mockAssignPremiumRole = vi.mocked(assignPremiumRole);
const mockFindOneAndUpdate = vi.mocked(UserProfile.findOneAndUpdate);

// Build a fake Stripe event payload
function makeEvent(type: string, metadata: Record<string, string> = { userId: 'user-123' }) {
  return JSON.stringify({
    id: 'evt_test',
    type,
    data: {
      object: {
        id: 'cs_test',
        object: 'checkout.session',
        metadata,
      },
    },
  });
}

// Mock stripe so constructEvent just returns the parsed payload
vi.mock('stripe', () => {
  const StripeMock = function (this: any) {
    this.webhooks = {
      constructEvent: (_body: Buffer, _sig: string, _secret: string) => JSON.parse(_body.toString()),
    };
    this.promotionCodes = { list: vi.fn().mockResolvedValue({ data: [] }) };
    this.checkout = { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://checkout.stripe.com/test' }) } };
  };
  return { default: StripeMock };
});

beforeEach(() => {
  mockAssignPremiumRole.mockReset();
  mockAssignPremiumRole.mockResolvedValue(undefined);
  mockFindOneAndUpdate.mockReset();
  mockFindOneAndUpdate.mockResolvedValue({} as any);
});

describe('POST /webhooks/stripe', () => {
  it('assigns premium role and sets expiry on checkout.session.completed', async () => {
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send(makeEvent('checkout.session.completed'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockAssignPremiumRole).toHaveBeenCalledWith('user-123');
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-123' },
      expect.objectContaining({ premiumExpiresAt: expect.any(Date) }),
      { upsert: true }
    );
  });

  it('sets premiumExpiresAt approximately one year from now', async () => {
    await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send(makeEvent('checkout.session.completed'));

    const call = mockFindOneAndUpdate.mock.calls[0];
    const { premiumExpiresAt } = call[1] as any;
    const oneYearMs = 365 * 24 * 60 * 60 * 1000;
    expect(premiumExpiresAt.getTime()).toBeGreaterThan(Date.now() + oneYearMs - 5000);
    expect(premiumExpiresAt.getTime()).toBeLessThan(Date.now() + oneYearMs + 5000);
  });

  it('returns 400 when userId is missing from session metadata', async () => {
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send(makeEvent('checkout.session.completed', {}));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/i);
    expect(mockAssignPremiumRole).not.toHaveBeenCalled();
  });

  it('returns 500 when assignPremiumRole fails so Stripe retries', async () => {
    mockAssignPremiumRole.mockRejectedValue(new Error('Auth0 unavailable'));

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send(makeEvent('checkout.session.completed'));

    expect(res.status).toBe(500);
  });

  it('ignores other event types and returns received: true', async () => {
    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 'test-sig')
      .send(makeEvent('payment_intent.created'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockAssignPremiumRole).not.toHaveBeenCalled();
  });
});
