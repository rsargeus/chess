import { describe, it, expect } from 'vitest';
import { detectOpening, OPENINGS } from '../openings';

// Real fixture line pulled from the dataset — Ruy López, Morphy Defense.
// Kept as a local constant so a future edit to openings.ts data doesn't
// silently break these tests; if 'ruy-morphy' ever changes shape, the
// sanity check below will fail loudly instead.
const RUY_MORPHY_MOVES = [
  'e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6',
  'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O',
];

describe('openings.ts test fixture sanity', () => {
  it('ruy-morphy line still matches the hardcoded fixture', () => {
    const opening = OPENINGS.find(o => o.id === 'ruy-lopez');
    const line = opening?.lines.find(l => l.id === 'ruy-morphy');
    expect(line?.moves).toEqual(RUY_MORPHY_MOVES);
  });
});

describe('detectOpening', () => {
  it('returns null for no moves played', () => {
    expect(detectOpening([])).toBeNull();
  });

  it('returns null when fewer than 4 plies are played, even if they match a known line', () => {
    expect(detectOpening(['e4', 'e5', 'Nf3'])).toBeNull();
  });

  it('matches at exactly the 4-ply minimum threshold', () => {
    const match = detectOpening(RUY_MORPHY_MOVES.slice(0, 4));
    expect(match).not.toBeNull();
    expect(match!.matchedPlies).toBe(4);
    expect(match!.line.id).toBe('ruy-morphy');
  });

  it('marks a match as neither deviated nor completed while still in-progress', () => {
    const match = detectOpening(RUY_MORPHY_MOVES.slice(0, 6));
    expect(match!.matchedPlies).toBe(6);
    expect(match!.deviated).toBe(false);
    expect(match!.completed).toBe(false);
  });

  it('marks a match as completed when every move in the line has been played', () => {
    const match = detectOpening(RUY_MORPHY_MOVES);
    expect(match!.matchedPlies).toBe(RUY_MORPHY_MOVES.length);
    expect(match!.completed).toBe(true);
    expect(match!.deviated).toBe(false);
  });

  it('marks a match as deviated once a played move breaks from the line before it ends', () => {
    const played = [...RUY_MORPHY_MOVES.slice(0, 6), 'Bc4']; // real line continues with 'Ba4' at index 6
    const match = detectOpening(played);
    expect(match!.matchedPlies).toBe(6);
    expect(match!.deviated).toBe(true);
    expect(match!.completed).toBe(false);
  });

  it('does not mark a match as deviated just because more moves were played after completing the line', () => {
    const played = [...RUY_MORPHY_MOVES, 'h3']; // line is fully consumed, extra move played beyond it
    const match = detectOpening(played);
    expect(match!.matchedPlies).toBe(RUY_MORPHY_MOVES.length);
    expect(match!.completed).toBe(true);
    expect(match!.deviated).toBe(false);
  });

  it('picks the longest matching prefix among multiple candidate lines', () => {
    // e4 e5 Nf3 Nc6 Bb5 is shared by every Ruy López line; a6 (Morphy-specific)
    // should push the match past whatever a shallower Ruy López branch offers.
    const match = detectOpening(RUY_MORPHY_MOVES.slice(0, 6));
    expect(match!.opening.id).toBe('ruy-lopez');
    expect(match!.line.id).toBe('ruy-morphy');
    expect(match!.matchedPlies).toBe(6);

    // Every other line's prefix match length must not exceed the winner's.
    for (const opening of OPENINGS) {
      for (const line of opening.lines) {
        let i = 0;
        const played = RUY_MORPHY_MOVES.slice(0, 6);
        while (i < line.moves.length && i < played.length && line.moves[i] === played[i]) i++;
        expect(i).toBeLessThanOrEqual(match!.matchedPlies);
      }
    }
  });

  it('returns null for a legal-looking move sequence that matches no known line', () => {
    expect(detectOpening(['a3', 'a6', 'a4', 'a5'])).toBeNull();
  });

  it('is exact-string matching on SAN, including castling notation', () => {
    // If castling were compared loosely this would still match past index 8;
    // corrupting just the castling move should stop the match exactly there.
    const corrupted = [...RUY_MORPHY_MOVES];
    corrupted[8] = 'O-O-O';
    const match = detectOpening(corrupted);
    expect(match!.matchedPlies).toBe(8);
  });
});
