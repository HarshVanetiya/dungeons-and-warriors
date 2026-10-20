'use client';

import { HERO_IDS, HEROES, type HeroId } from '@dungeon-drill/game';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { HeroCard } from '@/components/HeroCard';
import { Alert, Button, Spinner } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { HERO_STYLE } from '@/lib/heroes';
import { useElapsed } from '@/lib/useCountdown';
import type { Game } from '@/lib/useGame';

const LAST_HERO_KEY = 'dd:lastHero';

export function readLastHero(): HeroId {
  try {
    const v = localStorage.getItem(LAST_HERO_KEY);
    if (v && (HERO_IDS as string[]).includes(v)) return v as HeroId;
  } catch {
    // storage blocked: use the default
  }
  return 'knight';
}

export function Lobby({ game }: { game: Game }) {
  const { user, refresh } = useAuth();
  const [hero, setHero] = useState<HeroId>('knight');
  const [error, setError] = useState('');
  const [queuedAt, setQueuedAt] = useState<number | null>(null);
  const waited = useElapsed(game.queued ? queuedAt : null);

  useEffect(() => {
    if (game.queued && queuedAt === null) setQueuedAt(Date.now());
  }, [game.queued, queuedAt]);

  useEffect(() => {
    setHero(readLastHero());
    void refresh(); // pick up the new rating after a match
  }, [refresh]);

  const choose = (id: HeroId) => {
    setHero(id);
    try {
      localStorage.setItem(LAST_HERO_KEY, id);
    } catch {
      // not important
    }
  };

  async function findMatch() {
    setError('');
    const res = await game.queue(hero);
    if (!res.ok) return setError(errorMessage(res.error));
  }

  return (
    <div className="mt-4 space-y-6">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <p className="text-sm text-ash">Fighting as</p>
          <p className="font-display text-2xl font-extrabold tracking-wider">{user?.username}</p>
        </div>
        <dl className="flex gap-6 text-center">
          <div>
            <dt className="text-xs uppercase tracking-wider text-ash">Elo</dt>
            <dd className="font-display text-2xl font-extrabold text-gold tabular-nums">{user?.elo ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-ash">W / L / D</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {user ? `${user.wins} / ${user.losses} / ${user.draws}` : '—'}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="pick">
        <h1 id="pick" className="mb-4 font-display text-2xl font-extrabold tracking-wider">
          Choose your hero
        </h1>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {HERO_IDS.map((id) => (
            <HeroCard key={id} heroId={id} selected={hero === id} onSelect={game.queued ? undefined : () => choose(id)} />
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 z-10 flex flex-col items-center gap-3">
        {error ? <Alert>{error}</Alert> : null}
        {game.queued ? (
          <motion.div initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="panel flex flex-wrap items-center justify-center gap-4 px-6 py-4 shadow-glow">
            <Spinner className="text-shadow-bright" />
            <div>
              <p className="font-semibold">Searching for an opponent…</p>
              <p className="text-sm text-ash">
                As the <span style={{ color: HERO_STYLE[hero].color }}>{HEROES[hero].name}</span> · {Math.floor(waited / 60)}:
                {String(waited % 60).padStart(2, '0')} · only players within 273 Elo
              </p>
            </div>
            <Button variant="secondary" onClick={game.leaveQueue}>
              Cancel
            </Button>
          </motion.div>
        ) : (
          <Button onClick={findMatch} disabled={game.connection !== 'connected'} className="px-10 py-3 text-lg">
            {game.connection === 'connected' ? (
              <>Find match as {HEROES[hero].name}</>
            ) : (
              <>
                <Spinner /> Connecting…
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
