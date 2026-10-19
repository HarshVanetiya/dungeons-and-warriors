// GAME_RULES.md section 2. Run `npm run balance` after changing any stat.

export type HeroId = 'berserker' | 'rogue' | 'knight' | 'monk' | 'guardian';

export interface Hero {
  readonly id: HeroId;
  readonly name: string;
  readonly maxHp: number;
  readonly attackScore: number;
  readonly defenseScore: number;
}

export const HEROES: Readonly<Record<HeroId, Hero>> = {
  berserker: { id: 'berserker', name: 'Berserker', maxHp: 45, attackScore: 14, defenseScore: 6 },
  rogue: { id: 'rogue', name: 'Rogue', maxHp: 51, attackScore: 11, defenseScore: 8 },
  knight: { id: 'knight', name: 'Knight', maxHp: 60, attackScore: 9, defenseScore: 9 },
  monk: { id: 'monk', name: 'Monk', maxHp: 61, attackScore: 7, defenseScore: 11 },
  guardian: { id: 'guardian', name: 'Guardian', maxHp: 85, attackScore: 7, defenseScore: 9 },
};

export const HERO_IDS = Object.keys(HEROES) as HeroId[];

export function isHeroId(value: unknown): value is HeroId {
  return typeof value === 'string' && Object.hasOwn(HEROES, value);
}
