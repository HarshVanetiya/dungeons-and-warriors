import { describe, expect, it } from 'vitest';
import { secureRng, seededRng } from '../src/index.js';

describe('rng', () => {
  it('secureRng stays in range and hits every value', () => {
    const rng = secureRng();
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it('seededRng repeats for the same seed', () => {
    const a = seededRng(42);
    const b = seededRng(42);
    for (let i = 0; i < 100; i++) expect(a.int(1, 14)).toBe(b.int(1, 14));
  });

  it('rejects bad ranges', () => {
    expect(() => secureRng().int(5, 1)).toThrow(RangeError);
    expect(() => seededRng(1).int(0.5, 3)).toThrow(RangeError);
  });
});
