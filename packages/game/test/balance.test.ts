import { describe, expect, it } from 'vitest';
import { HEROES, HERO_IDS, exactWinChance } from '../src/index.js';

describe('hero balance (base rules)', () => {
  it('is exactly 50% in a mirror match', () => {
    expect(exactWinChance(HEROES.knight, HEROES.knight)).toBeCloseTo(0.5, 10);
  });

  it('keeps every matchup within 3% of 50/50', () => {
    for (const a of HERO_IDS) {
      for (const b of HERO_IDS) {
        if (a >= b) continue;
        const p = exactWinChance(HEROES[a], HEROES[b]);
        expect(Math.abs(p - 0.5), `${a} vs ${b}: ${(100 * p).toFixed(1)}%`).toBeLessThanOrEqual(0.03);
      }
    }
  });

  it('gives both sides of a matchup chances that add to 1', () => {
    const p = exactWinChance(HEROES.berserker, HEROES.guardian);
    const q = exactWinChance(HEROES.guardian, HEROES.berserker);
    expect(p + q).toBeCloseTo(1, 10);
  });
});
