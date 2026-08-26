import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { OPENINGS } from '../openings';

// Guards the hand-authored opening dataset itself, not detectOpening()'s
// logic. A typo'd SAN move or a duplicated id here corrupts training data
// silently — the app would just show a broken line or misidentify an
// opening with no error anywhere.

describe('openings.ts data integrity', () => {
  it('every line\'s moves are legal from the starting position', () => {
    for (const opening of OPENINGS) {
      for (const line of opening.lines) {
        const chess = new Chess();
        for (const san of line.moves) {
          expect(
            () => chess.move(san),
            `${opening.id}/${line.id}: illegal move "${san}" at position ${chess.fen()}`,
          ).not.toThrow();
        }
      }
    }
  });

  it('opening ids are unique', () => {
    const ids = OPENINGS.map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('line ids are unique across the entire dataset', () => {
    const ids = OPENINGS.flatMap(o => o.lines.map(l => l.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every opening has at least one line', () => {
    for (const opening of OPENINGS) {
      expect(opening.lines.length, `${opening.id} has no lines`).toBeGreaterThan(0);
    }
  });

  it('every line has enough moves to ever be detectable (>= 4 plies)', () => {
    // detectOpening() requires MIN_MATCH_PLIES=4 before it reports a match —
    // a shorter line can never be trained-into via live detection.
    for (const opening of OPENINGS) {
      for (const line of opening.lines) {
        expect(line.moves.length, `${opening.id}/${line.id} has only ${line.moves.length} moves`)
          .toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('ECO codes follow the standard format (letter A-E + two digits)', () => {
    const ecoPattern = /^[A-E]\d{2}$/;
    for (const opening of OPENINGS) {
      expect(opening.eco, `${opening.id} opening-level ECO`).toMatch(ecoPattern);
      for (const line of opening.lines) {
        expect(line.eco, `${opening.id}/${line.id} line-level ECO`).toMatch(ecoPattern);
      }
    }
  });

});
