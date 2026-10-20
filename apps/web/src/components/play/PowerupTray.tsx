'use client';

import { POWERUPS, type PowerupId } from '@dungeon-drill/game';
import { motion } from 'motion/react';
import { POWERUP_STYLE } from '@/lib/heroes';

const TIMING_LABEL = { attack: 'When attacking', defense: 'When defending', either: 'Any turn' } as const;

export function PowerupIcon({ id, size = 'md' }: { id: PowerupId; size?: 'md' | 'lg' }) {
  const { color, glyph } = POWERUP_STYLE[id];
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-full font-display font-extrabold ${size === 'lg' ? 'size-12 text-xl' : 'size-9 text-base'}`}
      style={{ color, background: `radial-gradient(circle, ${color}40, ${color}10 70%)`, boxShadow: `0 0 0 1px ${color}80, 0 0 14px ${color}55` }}
    >
      {glyph}
    </span>
  );
}

interface Props {
  held: PowerupId[];
  active: PowerupId[];
  attacking: boolean;
  disabled: boolean;
  onActivate: (id: PowerupId) => void;
}

/** Your held powerups, plus the ones activated for this round (they fire when the attacker attacks). */
export function PowerupTray({ held, active, attacking, disabled, onActivate }: Props) {
  const usable = (id: PowerupId) => {
    const t = POWERUPS[id].timing;
    return !active.includes(id) && (t === 'either' || (t === 'attack') === attacking);
  };
  return (
    <div className="panel p-3 sm:p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ash">Your powerups</h2>
        <span className="text-xs text-ash">Fill your energy to earn more</span>
      </div>
      {held.length === 0 && active.length === 0 ? (
        <p className="mt-2 text-sm text-ash">None yet. Taking and dealing damage fills your energy.</p>
      ) : null}
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {active.map((id, i) => (
          <motion.li key={`a-${id}-${i}`} layout initial={{ scale: 0.95 }} animate={{ scale: 1 }} className="flex items-center gap-3 rounded-lg border border-shadow bg-shadow/15 p-2 shadow-glow">
            <PowerupIcon id={id} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{POWERUPS[id].name}</p>
              <p className="text-xs text-shadow-bright">Active: fires on this attack</p>
            </div>
          </motion.li>
        ))}
        {held.map((id, i) => {
          const ok = usable(id) && !disabled;
          return (
            <li key={`h-${id}-${i}`}>
              <button
                type="button"
                disabled={!ok}
                onClick={() => onActivate(id)}
                className="flex w-full items-center gap-3 rounded-lg border border-stone-600 bg-stone-950/60 p-2 text-left transition enabled:hover:border-shadow enabled:hover:bg-shadow/10 disabled:opacity-45"
                title={POWERUPS[id].description}
              >
                <PowerupIcon id={id} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    {POWERUPS[id].name} <span className="ml-1 text-xs font-normal text-ash">{TIMING_LABEL[POWERUPS[id].timing]}</span>
                  </span>
                  <span className="block text-xs leading-snug text-ash">{POWERUPS[id].description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function PowerupOffer({ options, onPick }: { options: [PowerupId, PowerupId]; onPick: (id: PowerupId) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="panel border-shadow! p-4 shadow-glow">
      <p className="font-display text-lg font-extrabold tracking-wider text-shadow-bright">Energy full: choose a powerup</p>
      <p className="text-xs text-ash">Choose before your next attack, or one is picked for you at random.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {options.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onPick(id)}
            className="flex items-center gap-3 rounded-lg border border-stone-600 bg-stone-950/60 p-3 text-left transition hover:border-shadow-bright hover:bg-shadow/15"
          >
            <PowerupIcon id={id} size="lg" />
            <span>
              <span className="block font-semibold">{POWERUPS[id].name}</span>
              <span className="block text-xs text-ash">{POWERUPS[id].description}</span>
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}
