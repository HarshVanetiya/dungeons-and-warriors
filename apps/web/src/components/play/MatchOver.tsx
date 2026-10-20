'use client';

import type { MatchEnded, MatchFound, PlayerIndex } from '@dungeon-drill/game';
import { motion } from 'motion/react';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui';

// PixiJS needs the browser
const FightScene = dynamic(() => import('./FightScene').then((m) => m.FightScene), { ssr: false });

const REASON = {
  knockout: { win: 'Knockout! Their HP hit zero.', lose: 'Knocked out.' },
  exit: { win: 'Your opponent left the match.', lose: 'You left the match.' },
  timeout: { win: "Your opponent didn't attack in time.", lose: "You didn't attack within 30 seconds." },
  disconnect: { win: "Your opponent disconnected and didn't come back.", lose: 'You were disconnected for too long.' },
} as const;

export function MatchOver({ found, ended, onLobby, onPlayAgain }: { found: MatchFound; ended: MatchEnded; onLobby: () => void; onPlayAgain: () => void }) {
  const [phase, setPhase] = useState<'scene' | 'results'>('scene');
  const you = found.you;
  const opp: PlayerIndex = you === 0 ? 1 : 0;
  const { result } = ended;
  const outcome = result.kind === 'draw' ? 'draw' : result.winner === you ? 'win' : 'lose';

  if (phase === 'scene') {
    return (
      <div className="mt-4">
        <FightScene
          rounds={ended.rounds}
          heroes={[found.players[0].heroId, found.players[1].heroId]}
          names={[found.players[0].username, found.players[1].username]}
          you={you}
          result={result}
          onDone={() => setPhase('results')}
        />
      </div>
    );
  }

  const dealt = ended.rounds.reduce((n, r) => n + (r.attacker === you ? r.damageToDefender : r.damageToAttacker), 0);
  const taken = ended.rounds.reduce((n, r) => n + (r.attacker === you ? r.damageToAttacker : r.damageToDefender), 0);
  const title = { win: 'Victory', lose: 'Defeat', draw: 'Draw' }[outcome];
  const color = { win: 'text-gold', lose: 'text-red-400', draw: 'text-bone' }[outcome];
  const reason = result.kind === 'draw' ? 'You both agreed to a draw. Ratings are unchanged.' : REASON[result.kind][outcome === 'win' ? 'win' : 'lose'];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="panel mx-auto mt-8 max-w-lg p-6 text-center sm:p-8">
      <h1 className={`font-display text-5xl font-extrabold tracking-wider ${color}`}>{title}</h1>
      <p className="mt-2 text-ash">{reason}</p>
      <p className="mt-1 text-sm text-ash">vs {found.players[opp].username}</p>

      {ended.elo ? (
        <div className="mt-6">
          <p className="text-xs uppercase tracking-wider text-ash">Elo</p>
          <p className="font-display text-3xl font-extrabold tabular-nums">
            {ended.elo.before} → {ended.elo.after}{' '}
            <span className={ended.elo.delta > 0 ? 'text-heal' : ended.elo.delta < 0 ? 'text-red-400' : 'text-ash'}>
              ({ended.elo.delta > 0 ? '+' : ''}
              {ended.elo.delta})
            </span>
          </p>
        </div>
      ) : (
        <p className="mt-6 text-sm text-ember">The result couldn&apos;t be saved, so ratings didn&apos;t change.</p>
      )}

      <dl className="mt-6 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-stone-950/60 p-3">
          <dt className="text-ash">Rounds</dt>
          <dd className="text-lg font-semibold tabular-nums">{ended.rounds.length}</dd>
        </div>
        <div className="rounded-lg bg-stone-950/60 p-3">
          <dt className="text-ash">Damage dealt</dt>
          <dd className="text-lg font-semibold tabular-nums">{dealt}</dd>
        </div>
        <div className="rounded-lg bg-stone-950/60 p-3">
          <dt className="text-ash">Damage taken</dt>
          <dd className="text-lg font-semibold tabular-nums">{taken}</dd>
        </div>
      </dl>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={onPlayAgain} className="px-8">
          Play again
        </Button>
        <Button variant="secondary" onClick={onLobby}>
          Change hero
        </Button>
        <ButtonLink href="/leaderboard" variant="ghost">
          Leaderboard
        </ButtonLink>
      </div>
    </motion.div>
  );
}
