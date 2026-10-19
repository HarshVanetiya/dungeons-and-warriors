// Exact win chance under the base rules (no powerups), used by tests and `npm run balance`.

import type { Hero } from './heroes.js';

/** Chance that `x` beats `y` when a coin flip decides who attacks first. */
export function exactWinChance(x: Hero, y: Hero): number {
  // diffs[a] = distribution of (attack roll - defense roll) when player a attacks (0 = x, 1 = y)
  const diffs = [rollDiffs(x.attackScore, y.defenseScore), rollDiffs(y.attackScore, x.defenseScore)] as const;
  const memo = new Map<number, [number, number]>();

  // [chance x wins if x attacks next, chance x wins if y attacks next]
  const solve = (hx: number, hy: number): [number, number] => {
    if (hx <= 0) return [0, 0];
    if (hy <= 0) return [1, 1];
    const key = hx * 100_000 + hy;
    const cached = memo.get(key);
    if (cached) return cached;
    const rest: [number, number] = [0, 0];
    const zero: [number, number] = [0, 0];
    for (const a of [0, 1] as const) {
      for (const [diff, p] of diffs[a]) {
        if (diff === 0) {
          zero[a] += p;
          continue;
        }
        // positive diff hurts the defender, negative hurts the attacker
        const xHurt = (a === 1) === diff > 0;
        const next = xHurt ? solve(hx - Math.abs(diff), hy) : solve(hx, hy - Math.abs(diff));
        rest[a] += p * next[a === 0 ? 1 : 0];
      }
    }
    // a 0-damage round only swaps roles, so the two states are solved together
    const p0 = (rest[0] + zero[0] * rest[1]) / (1 - zero[0] * zero[1]);
    const result: [number, number] = [p0, rest[1] + zero[1] * p0];
    memo.set(key, result);
    return result;
  };

  const [xFirst, yFirst] = solve(x.maxHp, y.maxHp);
  return (xFirst + yFirst) / 2;
}

function rollDiffs(attackScore: number, defenseScore: number): Map<number, number> {
  const out = new Map<number, number>();
  const p = 1 / (attackScore * defenseScore);
  for (let a = 1; a <= attackScore; a++) {
    for (let d = 1; d <= defenseScore; d++) out.set(a - d, (out.get(a - d) ?? 0) + p);
  }
  return out;
}
