'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Lobby, readLastHero } from '@/components/play/Lobby';
import { MatchOver } from '@/components/play/MatchOver';
import { MatchScreen } from '@/components/play/MatchScreen';
import { Button, Spinner } from '@/components/ui';
import { useGame } from '@/lib/useGame';

export default function PlayPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user === null) router.replace('/login?next=/play');
  }, [user, router]);

  if (!user) {
    return (
      <div className="mt-16 flex justify-center text-ash">
        <Spinner />
      </div>
    );
  }
  return <Play />;
}

function Play() {
  const game = useGame();

  if (game.connection === 'replaced') {
    return (
      <div className="panel mx-auto mt-12 max-w-md p-6 text-center">
        <h1 className="font-display text-xl font-extrabold tracking-wider">Playing in another tab</h1>
        <p className="mt-2 text-sm text-ash">You opened Dungeon Drill somewhere else, so this tab was disconnected.</p>
        <Button className="mt-5" onClick={game.reclaim}>
          Play here instead
        </Button>
      </div>
    );
  }
  if (game.connection === 'unauthorized') {
    return (
      <div className="panel mx-auto mt-12 max-w-md p-6 text-center">
        <p>Your session expired. Please log in again.</p>
      </div>
    );
  }
  if (game.found && game.ended) {
    return (
      <MatchOver
        key={game.found.matchId}
        found={game.found}
        ended={game.ended}
        onLobby={game.backToLobby}
        onPlayAgain={() => {
          game.backToLobby();
          void game.queue(readLastHero());
        }}
      />
    );
  }
  if (game.found && game.update) return <MatchScreen game={game} />;
  return <Lobby game={game} />;
}
