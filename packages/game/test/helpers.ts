import { applyAction, createMatch, type HeroId, type MatchAction, type MatchState, type Rng } from '../src/index.js';

/** RNG that returns exactly these values in order and fails if a value is out of the requested range. */
export function scriptedRng(values: number[]): Rng & { remaining: () => number } {
  const queue = [...values];
  return {
    int(min, max) {
      const v = queue.shift();
      if (v === undefined) throw new Error(`scriptedRng ran out (asked for [${min}, ${max}])`);
      if (v < min || v > max) throw new Error(`scripted value ${v} is outside [${min}, ${max}]`);
      return v;
    },
    remaining: () => queue.length,
  };
}

/** New match where player 0 attacks first. */
export function newMatch(heroes: [HeroId, HeroId], firstAttacker: 0 | 1 = 0): MatchState {
  return createMatch(heroes, scriptedRng([firstAttacker])).state;
}

/** Copy of `state` with `change` applied, for setting up a situation directly. */
export function tweak(state: MatchState, change: (s: MatchState) => void): MatchState {
  const copy = structuredClone(state);
  change(copy);
  return copy;
}

/** Apply an action that must succeed. */
export function act(state: MatchState, action: MatchAction, rolls: number[] = []) {
  const rng = scriptedRng(rolls);
  const result = applyAction(state, action, rng);
  if (!result.ok) throw new Error(`action ${action.type} failed: ${result.error}`);
  if (rng.remaining() > 0) throw new Error(`${rng.remaining()} scripted values were not used`);
  return result;
}

export function lastRound(state: MatchState) {
  const r = state.rounds.at(-1);
  if (!r) throw new Error('no rounds yet');
  return r;
}
