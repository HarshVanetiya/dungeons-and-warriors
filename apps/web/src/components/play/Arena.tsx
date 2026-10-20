'use client';

import { HEROES, POWERUPS, type HeroId, type PlayerIndex, type RoundResult } from '@dungeon-drill/game';
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import { useEffect, useState } from 'react';
import { HeroFigure } from '@/components/HeroFigure';
import { POWERUP_STYLE } from '@/lib/heroes';

interface Props {
  you: PlayerIndex;
  heroes: [HeroId, HeroId];
  round: RoundResult | undefined;
}

interface Popup {
  id: number;
  side: 'left' | 'right';
  text: string;
  tone: 'damage' | 'heal' | 'info';
}

/** You on the left, the opponent on the right. Animates the latest round. */
export function Arena({ you, heroes, round }: Props) {
  const [scope, animate] = useAnimate();
  const [popups, setPopups] = useState<Popup[]>([]);
  const sideOf = (p: PlayerIndex) => (p === you ? 'left' : 'right');

  useEffect(() => {
    if (!round) return;
    const att = sideOf(round.attacker);
    const def = att === 'left' ? 'right' : 'left';
    const dir = att === 'left' ? 1 : -1;
    const add = (p: Omit<Popup, 'id'>) => {
      const id = Math.random();
      setPopups((list) => [...list, { ...p, id }]);
      setTimeout(() => setPopups((list) => list.filter((x) => x.id !== id)), 1400);
    };
    void (async () => {
      await animate(`[data-side=${att}]`, { x: [0, dir * 70] }, { duration: 0.16, ease: 'easeIn' });
      if (round.damageToDefender > 0) {
        add({ side: def, text: `-${round.damageToDefender}`, tone: 'damage' });
        void animate(`[data-side=${def}]`, { x: [0, dir * 14, -dir * 8, dir * 4, 0], filter: ['brightness(3)', 'brightness(1)'] }, { duration: 0.35 });
      } else if (round.damageToAttacker > 0) {
        add({ side: def, text: 'Blocked!', tone: 'info' });
        add({ side: att, text: `-${round.damageToAttacker}`, tone: 'damage' });
      } else {
        add({ side: def, text: 'Clash', tone: 'info' });
      }
      round.healed.forEach((h, p) => h > 0 && add({ side: sideOf(p as PlayerIndex), text: `+${h}`, tone: 'heal' }));
      await animate(
        `[data-side=${att}]`,
        { x: round.damageToAttacker > 0 ? [dir * 70, -dir * 30, 0] : [dir * 70, 0] },
        { duration: round.damageToAttacker > 0 ? 0.45 : 0.3, ease: 'easeOut' },
      );
    })();
  }, [round?.round]); // animate once per new round

  const figure = (side: 'left' | 'right') => {
    const p: PlayerIndex = side === 'left' ? you : you === 0 ? 1 : 0;
    return (
      <div className="relative flex flex-col items-center">
        <div data-side={side}>
          <HeroFigure heroId={heroes[p]} facing={side === 'left' ? 'right' : 'left'} className="h-40 w-auto drop-shadow-[0_10px_14px_rgb(0_0_0/0.9)] sm:h-56" />
        </div>
        <div aria-hidden className="mt-1 h-3 w-28 rounded-[50%] bg-black/70 blur-[3px] sm:w-36" />
        <AnimatePresence>
          {popups
            .filter((x) => x.side === side)
            .map((x, i) => (
              <motion.span
                key={x.id}
                initial={{ y: 0, opacity: 0, scale: 0.6 }}
                animate={{ y: -60 - i * 26, opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`pointer-events-none absolute top-8 font-display text-2xl font-extrabold drop-shadow-[0_2px_4px_black] sm:text-3xl ${
                  x.tone === 'damage' ? 'text-red-400' : x.tone === 'heal' ? 'text-heal' : 'text-bone'
                }`}
              >
                {x.text}
              </motion.span>
            ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div ref={scope} className="relative overflow-hidden rounded-xl border border-stone-800 bg-[radial-gradient(ellipse_70%_60%_at_50%_100%,rgb(249_115_22/0.12),transparent_70%),linear-gradient(180deg,#0e0b15,#07060a)]">
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(180deg,transparent,rgb(0_0_0/0.6))]" />
      <div className="relative grid grid-cols-2 items-end px-4 pt-10 pb-4 sm:px-16">
        {figure('left')}
        {figure('right')}
      </div>
      {round ? <RollLine round={round} you={you} heroes={heroes} /> : <p className="relative pb-4 text-center text-sm text-ash">The duel begins.</p>}
    </div>
  );
}

function RollLine({ round, you, heroes }: { round: RoundResult; you: PlayerIndex; heroes: [HeroId, HeroId] }) {
  const att = round.attacker;
  const def: PlayerIndex = att === 0 ? 1 : 0;
  const who = (p: PlayerIndex) => (p === you ? 'You' : HEROES[heroes[p]].name);
  const chip = (label: string, roll: number, value: number) => (
    <span className="rounded-md bg-stone-950/80 px-2 py-1 font-semibold tabular-nums ring-1 ring-stone-700">
      {label} {value}
      {value !== roll ? <span className="ml-1 text-xs text-ash">(rolled {roll})</span> : null}
    </span>
  );
  const used = [...round.attackerPowerups, ...round.defenderPowerups];
  const outcome =
    round.damageToDefender > 0
      ? `${who(def)} take${def === you ? '' : 's'} ${round.damageToDefender}`
      : round.damageToAttacker > 0
        ? `Countered! ${who(att)} take${att === you ? '' : 's'} ${round.damageToAttacker}`
        : 'Even rolls, no damage';
  return (
    <motion.div key={round.round} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="relative flex flex-wrap items-center justify-center gap-2 px-3 pb-4 text-sm">
      <span className="text-ash">Round {round.round}:</span>
      {chip('Attack', round.attackRoll, round.attackValue)}
      <span className="text-ash">vs</span>
      {chip('Defense', round.defenseRoll, round.defenseValue)}
      <span className="font-semibold">→ {outcome}</span>
      {used.map((u, i) => (
        <span key={i} className="rounded px-1.5 py-0.5 text-xs font-semibold" style={{ background: `${POWERUP_STYLE[u].color}33`, color: POWERUP_STYLE[u].color }}>
          {POWERUPS[u].name}
        </span>
      ))}
    </motion.div>
  );
}
