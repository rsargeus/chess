import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../../app';

vi.mock('../../middleware/auth', () => ({
  jwtCheck: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../coaching', () => ({
  generateCoachMessage: vi.fn(),
}));

import { generateCoachMessage as mockGenerate } from '../../coaching';
const mockGenerateCoachMessage = vi.mocked(mockGenerate);

beforeEach(() => {
  mockGenerateCoachMessage.mockReset();
  mockGenerateCoachMessage.mockResolvedValue('Nice move!');
});

describe('POST /coach', () => {
  it('returns the generated coach message', async () => {
    const res = await request(app).post('/coach').send({ playerMoveSan: 'e4' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ coachMessage: 'Nice move!' });
  });

  it('passes opening name and ECO through to the coaching prompt', async () => {
    await request(app).post('/coach').send({
      playerMoveSan: 'O-O',
      openingName: 'Ruy López',
      openingEco: 'C88',
    });
    expect(mockGenerateCoachMessage).toHaveBeenCalledWith(
      expect.objectContaining({ openingName: 'Ruy López', openingEco: 'C88' }),
    );
  });

  it('defaults opening fields to null when not provided', async () => {
    await request(app).post('/coach').send({ playerMoveSan: 'e4' });
    expect(mockGenerateCoachMessage).toHaveBeenCalledWith(
      expect.objectContaining({ openingName: null, openingEco: null }),
    );
  });

  it('ignores non-string opening fields instead of passing them through', async () => {
    await request(app).post('/coach').send({ openingName: 12345, openingEco: { bad: true } });
    expect(mockGenerateCoachMessage).toHaveBeenCalledWith(
      expect.objectContaining({ openingName: null, openingEco: null }),
    );
  });

  it('defaults alternatives to an empty array when not an array', async () => {
    await request(app).post('/coach').send({ alternatives: 'not-an-array' });
    expect(mockGenerateCoachMessage).toHaveBeenCalledWith(
      expect.objectContaining({ alternatives: [] }),
    );
  });

  it('coerces isOpponent to a strict boolean', async () => {
    await request(app).post('/coach').send({ isOpponent: 'yes' });
    expect(mockGenerateCoachMessage).toHaveBeenCalledWith(
      expect.objectContaining({ isOpponent: false }),
    );
  });

  it('returns 500 when coaching generation fails', async () => {
    mockGenerateCoachMessage.mockRejectedValue(new Error('Groq unavailable'));
    const res = await request(app).post('/coach').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });
});
