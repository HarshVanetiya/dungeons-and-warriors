import type { HeroId, PowerupId } from '@dungeon-drill/game';

// Presentation only; stats come from @dungeon-drill/game (GAME_RULES.md sections 2 and 9).
export const HERO_STYLE: Record<HeroId, { tagline: string; style: string; color: string }> = {
  berserker: { tagline: 'Huge hits, weak guard', style: 'Wins fast or dies fast. Fur and twin axes.', color: '#e0523f' },
  rogue: { tagline: 'Quick and sharp', style: 'Attack-leaning, a little sturdier than the Berserker.', color: '#4fc38a' },
  knight: { tagline: 'Even at everything', style: 'Plate armour, sword and shield. The baseline hero.', color: '#d9b45a' },
  monk: { tagline: 'Counter-puncher', style: 'Best guard. Attackers often hurt themselves.', color: '#58a6e8' },
  guardian: { tagline: 'Walking fortress', style: 'Weak dice, but by far the most HP.', color: '#b08cf0' },
};

export const POWERUP_STYLE: Record<PowerupId, { color: string; glyph: string }> = {
  berserk: { color: '#ef4444', glyph: 'B' },
  luckyStrike: { color: '#eab308', glyph: 'L' },
  vampiricEdge: { color: '#be123c', glyph: 'V' },
  ironWall: { color: '#3b82f6', glyph: 'I' },
  fortress: { color: '#94a3b8', glyph: 'F' },
  thorns: { color: '#22c55e', glyph: 'T' },
  secondWind: { color: '#2dd4bf', glyph: 'S' },
};
