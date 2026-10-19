// GAME_RULES.md section 7.

import type { Hero } from './heroes.js';

export type PowerupId =
  | 'berserk'
  | 'luckyStrike'
  | 'vampiricEdge'
  | 'ironWall'
  | 'fortress'
  | 'thorns'
  | 'secondWind';

/** When a powerup may be activated: on your attacking turn, your defending turn, or either. */
export type PowerupTiming = 'attack' | 'defense' | 'either';

export interface Powerup {
  readonly id: PowerupId;
  readonly name: string;
  readonly timing: PowerupTiming;
  readonly description: string;
}

export const POWERUPS: Readonly<Record<PowerupId, Powerup>> = {
  berserk: { id: 'berserk', name: 'Berserk', timing: 'attack', description: 'This attack value = roll + half your attack score (rounded up).' },
  luckyStrike: { id: 'luckyStrike', name: 'Lucky Strike', timing: 'attack', description: 'This attack value = your full attack score.' },
  vampiricEdge: { id: 'vampiricEdge', name: 'Vampiric Edge', timing: 'attack', description: 'If this attack deals damage, heal 50% of it (rounded down).' },
  ironWall: { id: 'ironWall', name: 'Iron Wall', timing: 'defense', description: 'This defense value = roll + half your defense score (rounded up).' },
  fortress: { id: 'fortress', name: 'Fortress', timing: 'defense', description: 'This defense value = your full defense score.' },
  thorns: { id: 'thorns', name: 'Thorns', timing: 'defense', description: 'If you block this attack, the attacker takes double counter damage.' },
  secondWind: { id: 'secondWind', name: 'Second Wind', timing: 'either', description: 'Heal 20% of your max HP (rounded down).' },
};

export const POWERUP_IDS = Object.keys(POWERUPS) as PowerupId[];

export function isPowerupId(value: unknown): value is PowerupId {
  return typeof value === 'string' && Object.hasOwn(POWERUPS, value);
}

export const ENERGY_MAX = 100;
export const MAX_HELD_POWERUPS = 2;
/** Energy per full 1% of your own max HP lost. */
export const ENERGY_PER_PERCENT_TAKEN = 2;
/** Energy per full 1% of the opponent's max HP they lose. */
export const ENERGY_PER_PERCENT_DEALT = 1;

/** Energy earned when `victimMaxHp`'s owner loses `hpLost`: [victim's gain, dealer's gain]. */
export function energyForDamage(hpLost: number, victimMaxHp: number): [taken: number, dealt: number] {
  const percent = Math.floor((100 * hpLost) / victimMaxHp);
  return [percent * ENERGY_PER_PERCENT_TAKEN, percent * ENERGY_PER_PERCENT_DEALT];
}

/** Stacking rule: each roll powerup gives its own value and the highest counts. */
export function attackValue(roll: number, hero: Hero, active: readonly PowerupId[]): number {
  const options = [roll];
  if (active.includes('berserk')) options.push(roll + Math.ceil(hero.attackScore / 2));
  if (active.includes('luckyStrike')) options.push(hero.attackScore);
  return Math.max(...options);
}

export function defenseValue(roll: number, hero: Hero, active: readonly PowerupId[]): number {
  const options = [roll];
  if (active.includes('ironWall')) options.push(roll + Math.ceil(hero.defenseScore / 2));
  if (active.includes('fortress')) options.push(hero.defenseScore);
  return Math.max(...options);
}

export function secondWindHeal(hero: Hero): number {
  return Math.floor(hero.maxHp / 5);
}
