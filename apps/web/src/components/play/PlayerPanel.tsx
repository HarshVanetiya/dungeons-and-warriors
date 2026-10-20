'use client';

import { ENERGY_MAX, HEROES, MAX_HELD_POWERUPS, type HeroId } from '@dungeon-drill/game';
import { motion } from 'motion/react';
import { HERO_STYLE } from '@/lib/heroes';

interface Props {
  username: string;
  elo: number;
  heroId: HeroId;
  hp: number;
  energy: number;
  heldCount: number;
  side: 'left' | 'right';
  you?: boolean;
  attacking: boolean;
}

export function PlayerPanel({ username, elo, heroId, hp, energy, heldCount, side, you, attacking }: Props) {
  const hero = HEROES[heroId];
  const color = HERO_STYLE[heroId].color;
  const hpPct = (100 * hp) / hero.maxHp;
  const full = energy >= ENERGY_MAX;
  const right = side === 'right';
  return (
    <div className={`panel p-3 sm:p-4 ${right ? 'text-right' : ''}`}>
      <div className={`flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="truncate font-semibold">{username}</span>
        {you ? <span className="rounded bg-shadow/30 px-1.5 text-xs text-shadow-bright">you</span> : null}
        <span className="text-xs tabular-nums text-ash">{elo}</span>
      </div>
      <div className={`flex items-center gap-2 text-xs ${right ? 'flex-row-reverse' : ''}`}>
        <span className="font-display font-extrabold tracking-wider" style={{ color }}>
          {hero.name}
        </span>
        <span className={`rounded px-1.5 py-0.5 font-semibold uppercase tracking-wider ${attacking ? 'bg-ember/20 text-ember' : 'bg-sky-500/15 text-sky-300'}`}>
          {attacking ? 'Attacking' : 'Defending'}
        </span>
      </div>

      <div className="mt-2.5" aria-label={`HP ${hp} of ${hero.maxHp}`}>
        <div className={`mb-1 flex justify-between text-xs ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-ash">HP</span>
          <span className="font-semibold tabular-nums">
            {hp} / {hero.maxHp}
          </span>
        </div>
        <div className={`relative h-3 overflow-hidden rounded-full bg-stone-950 ring-1 ring-stone-700 ${right ? '-scale-x-100' : ''}`}>
          <motion.div className="absolute inset-y-0 left-0 bg-blood/50" animate={{ width: `${hpPct}%` }} transition={{ duration: 0.9, delay: 0.35 }} />
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ background: hpPct > 50 ? 'linear-gradient(90deg,#16a34a,#4ade80)' : hpPct > 25 ? 'linear-gradient(90deg,#ca8a04,#facc15)' : 'linear-gradient(90deg,#b91c1c,#f87171)' }}
            animate={{ width: `${hpPct}%` }}
            transition={{ duration: 0.25 }}
          />
        </div>
      </div>

      <div className="mt-2" aria-label={`Energy ${energy} of ${ENERGY_MAX}`}>
        <div className={`mb-1 flex justify-between text-xs ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-ash">Energy</span>
          <span className="tabular-nums text-shadow-bright">{energy}</span>
        </div>
        <div className={`h-2 overflow-hidden rounded-full bg-stone-950 ring-1 ring-stone-700 ${right ? '-scale-x-100' : ''} ${full ? 'shadow-glow' : ''}`}>
          <motion.div className="h-full bg-gradient-to-r from-[#4c1d95] via-shadow to-shadow-bright" animate={{ width: `${(100 * energy) / ENERGY_MAX}%` }} />
        </div>
      </div>

      <div className={`mt-2.5 flex items-center gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="text-xs text-ash">Powerups</span>
        {Array.from({ length: MAX_HELD_POWERUPS }, (_, i) => (
          <span
            key={i}
            className={`size-4 rounded-sm border ${i < heldCount ? 'border-shadow-bright bg-shadow/60 shadow-[0_0_8px_rgb(139_92_246/0.7)]' : 'border-stone-600 bg-stone-950'}`}
          />
        ))}
      </div>
    </div>
  );
}
