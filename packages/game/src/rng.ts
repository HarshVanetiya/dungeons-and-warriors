/** Source of randomness. `int(min, max)` returns a whole number in [min, max], every value equally likely. */
export interface Rng {
  int(min: number, max: number): number;
}

interface WebCrypto {
  getRandomValues<T extends Uint32Array>(array: T): T;
}

/**
 * Cryptographically secure RNG for real matches (GAME_RULES.md section 4: dice are rolled on the server).
 * Uses Web Crypto, which exists in Node 19+ and browsers. Rejection sampling keeps every value equally likely.
 */
export function secureRng(): Rng {
  const webCrypto = (globalThis as { crypto?: WebCrypto }).crypto;
  if (!webCrypto) throw new Error('Web Crypto is not available');
  const buf = new Uint32Array(1);
  const RANGE = 2 ** 32;
  return {
    int(min, max) {
      const span = checkRange(min, max);
      const limit = RANGE - (RANGE % span);
      let x: number;
      do {
        x = webCrypto.getRandomValues(buf)[0]!;
      } while (x >= limit);
      return min + (x % span);
    },
  };
}

/** Deterministic RNG (mulberry32) for tests, replays and balance simulations. Never use it for real matches. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  return {
    int(min, max) {
      return min + Math.floor(next() * checkRange(min, max));
    },
  };
}

function checkRange(min: number, max: number): number {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new RangeError(`invalid range [${min}, ${max}]`);
  }
  return max - min + 1;
}
