'use client';

import type { ClientAction, PlayerIndex, PowerupId } from '@dungeon-drill/game';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Modal } from '@/components/Modal';
import { Button } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useSecondsLeft } from '@/lib/useCountdown';
import type { Game } from '@/lib/useGame';
import { Arena } from './Arena';
import { PlayerPanel } from './PlayerPanel';
import { PowerupOffer, PowerupTray } from './PowerupTray';

export function MatchScreen({ game }: { game: Game }) {
  const found = game.found!;
  const { view, timers, events } = game.update!;
  const you = view.you;
  const opp: PlayerIndex = you === 0 ? 1 : 0;
  const attacking = view.attacker === you;
  const active = view.status === 'active';
  const incomingDraw = view.drawOffer !== null && view.drawOffer.by !== you;
  const outgoingDraw = view.drawOffer !== null && view.drawOffer.by === you;

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const turnLeft = useSecondsLeft(timers.turnEndsAt, game.clockOffset);
  const drawLeft = useSecondsLeft(timers.drawAnswerEndsAt, game.clockOffset);
  const oppGone = useSecondsLeft(timers.reconnectEndsAt[opp], game.clockOffset);

  // short notices for things the opponent did
  useEffect(() => {
    for (const e of events) {
      if (e.type === 'opponentPickedPowerup') flash('Your opponent gained a powerup');
      if (e.type === 'drawRejected') flash(e.by === you ? 'Your draw offer was rejected' : 'Draw offer rejected');
    }
  }, [events]); // once per update

  function flash(text: string) {
    setToast(text);
    setTimeout(() => setToast((t) => (t === text ? null : t)), 2500);
  }

  async function send(action: ClientAction) {
    setBusy(true);
    const res = await game.act(action);
    setBusy(false);
    if (!res.ok) flash(errorMessage(res.error));
  }

  // Space or Enter attacks when it's your turn
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || !attacking || !active || view.drawOffer || busy) return;
      if ((e.target as HTMLElement).closest('button, input, [role=dialog]')) return;
      e.preventDefault();
      void send({ type: 'attack' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const panel = (p: PlayerIndex, side: 'left' | 'right') => (
    <PlayerPanel
      username={found.players[p].username}
      elo={found.players[p].elo}
      heroId={found.players[p].heroId}
      hp={p === you ? view.me.hp : view.opponent.hp}
      energy={p === you ? view.me.energy : view.opponent.energy}
      heldCount={p === you ? view.me.held.length + view.me.active.length : view.opponent.heldCount}
      side={side}
      you={p === you}
      attacking={view.attacker === p}
    />
  );

  return (
    <div className="mt-2 space-y-3">
      {game.connection !== 'connected' ? (
        <div role="status" className="rounded-lg border border-ember/50 bg-ember/10 px-4 py-2 text-center text-sm">
          Connection lost. Reconnecting… you have 30 seconds before the match counts as a loss.
        </div>
      ) : null}
      {oppGone !== null ? (
        <div role="status" className="rounded-lg border border-shadow/50 bg-shadow/10 px-4 py-2 text-center text-sm">
          Your opponent disconnected. They lose in {oppGone}s unless they come back.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {panel(you, 'left')}
        {panel(opp, 'right')}
      </div>

      <TurnBanner attacking={attacking} seconds={turnLeft} outgoingDraw={outgoingDraw} round={view.round} />

      <Arena you={you} heroes={[found.players[0].heroId, found.players[1].heroId]} round={view.rounds.at(-1)} />

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          onClick={() => send({ type: 'attack' })}
          disabled={!attacking || !active || busy || view.drawOffer !== null || game.connection !== 'connected'}
          className="min-w-48 px-10 py-3 text-lg"
        >
          {attacking ? 'Attack!' : 'Opponent is attacking'}
        </Button>
        {view.canOfferDraw ? (
          <Button variant="secondary" disabled={busy} onClick={() => send({ type: 'offerDraw' })}>
            Offer draw
          </Button>
        ) : null}
        <Button variant="danger" onClick={() => setConfirmExit(true)}>
          Exit
        </Button>
      </div>
      {attacking && active ? <p className="text-center text-xs text-ash">Tip: press Space to attack. Activate powerups first.</p> : null}

      {view.me.offer ? <PowerupOffer options={view.me.offer} onPick={(powerup) => send({ type: 'pickPowerup', powerup })} /> : null}
      <PowerupTray
        held={view.me.held}
        active={view.me.active}
        attacking={attacking}
        disabled={!active || busy}
        onActivate={(powerup: PowerupId) => send({ type: 'activatePowerup', powerup })}
      />

      <Modal open={incomingDraw} title="Your opponent offers a draw">
        <p className="text-sm text-ash">A draw doesn&apos;t change anyone&apos;s Elo. No answer in {drawLeft ?? 0}s counts as a reject.</p>
        <div className="mt-5 flex gap-3">
          <Button className="flex-1" onClick={() => send({ type: 'respondDraw', accept: true })}>
            Accept draw
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => send({ type: 'respondDraw', accept: false })}>
            Keep fighting
          </Button>
        </div>
      </Modal>

      <Modal open={confirmExit} title="Leave the match?" onClose={() => setConfirmExit(false)}>
        <p className="text-sm text-ash">Leaving counts as a loss, and your Elo goes down.</p>
        <div className="mt-5 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => setConfirmExit(false)}>
            Stay
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={() => {
              setConfirmExit(false);
              void send({ type: 'exit' });
            }}
          >
            Leave and lose
          </Button>
        </div>
      </Modal>

      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="panel fixed bottom-6 left-1/2 z-40 -translate-x-1/2 px-4 py-2 text-sm"
          >
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TurnBanner({ attacking, seconds, outgoingDraw, round }: { attacking: boolean; seconds: number | null; outgoingDraw: boolean; round: number }) {
  const urgent = seconds !== null && seconds <= 10;
  return (
    <div className="flex items-center justify-center gap-3 text-center">
      <span className="text-xs uppercase tracking-wider text-ash">Round {round}</span>
      <motion.span
        key={`${round}-${attacking}`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`font-display text-xl font-extrabold tracking-wider sm:text-2xl ${attacking ? 'text-ember' : 'text-sky-300'}`}
      >
        {outgoingDraw ? 'Draw offered…' : attacking ? 'Your attack' : 'Defend'}
      </motion.span>
      {seconds !== null ? (
        <span className={`min-w-12 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ring-1 ${urgent ? 'animate-pulse bg-blood/20 text-red-300 ring-blood/60' : 'text-ash ring-stone-700'}`}>
          {seconds}s
        </span>
      ) : null}
    </div>
  );
}
