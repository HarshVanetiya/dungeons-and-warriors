import { describe, expect, it } from 'vitest';
import { STARTING_ELO, applyElo, canMatch, eloDelta, expectedScore } from '../src/index.js';

describe('elo', () => {
  it('starts at 1200', () => {
    expect(STARTING_ELO).toBe(1200);
  });

  it('gives equal players a 50% expected score', () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
  });

  it('matches the table in GAME_RULES.md', () => {
    // [gap, stronger player wins, weaker player wins]
    const table = [
      [0, 16, 16],
      [100, 12, 20],
      [200, 8, 24],
      [273, 6, 26],
    ] as const;
    for (const [gap, strongWins, weakWins] of table) {
      expect(eloDelta(1200 + gap, 1200)).toBe(strongWins);
      expect(eloDelta(1200, 1200 + gap)).toBe(weakWins);
    }
  });

  it('is zero-sum: the winner gains exactly what the loser loses', () => {
    for (const [a, b] of [[1200, 1200], [1350, 1210], [1100, 1373], [987, 1001]] as const) {
      for (const outcome of ['aWins', 'bWins'] as const) {
        const r = applyElo(a, b, outcome);
        expect(r.a + r.b).toBe(a + b);
        expect(r.a - a).toBe(r.deltaA);
      }
    }
  });

  it('beating a stronger player gains more than beating a weaker one', () => {
    expect(applyElo(1200, 1400, 'aWins').deltaA).toBeGreaterThan(applyElo(1200, 1000, 'aWins').deltaA);
  });

  it('losing to a weaker player costs more', () => {
    expect(applyElo(1400, 1200, 'bWins').deltaA).toBeLessThan(applyElo(1000, 1200, 'bWins').deltaA);
  });

  it('changes nothing on a draw', () => {
    expect(applyElo(1300, 1100, 'draw')).toEqual({ a: 1300, b: 1100, deltaA: 0 });
  });

  it('only matches players within 273 points', () => {
    expect(canMatch(1200, 1200)).toBe(true);
    expect(canMatch(1200, 1473)).toBe(true);
    expect(canMatch(1473, 1200)).toBe(true);
    expect(canMatch(1200, 1474)).toBe(false);
    expect(canMatch(1474, 1200)).toBe(false);
  });
});
