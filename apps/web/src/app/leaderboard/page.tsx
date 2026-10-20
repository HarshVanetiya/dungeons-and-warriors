'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Button, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';

interface Row {
  rank: number;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

const PAGE = 50;

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);

  async function load(offset: number) {
    setLoading(true);
    const res = await api<{ players: Row[] }>(`/leaderboard?limit=${PAGE}&offset=${offset}`);
    setLoading(false);
    if (!res.ok) return setError(errorMessage(res.error));
    setError('');
    setRows((r) => (offset === 0 ? res.data.players : [...(r ?? []), ...res.data.players]));
    setMore(res.data.players.length === PAGE);
  }

  useEffect(() => {
    void load(0);
  }, []);

  return (
    <div className="mx-auto mt-6 max-w-3xl">
      <h1 className="font-display text-3xl font-extrabold tracking-wider">Leaderboard</h1>
      <p className="mt-1 text-sm text-ash">Everyone starts at 1200. Beat stronger players to climb faster.</p>
      <div className="mt-6 space-y-3">
        {error ? <Alert>{error}</Alert> : null}
        {rows === null && !error ? (
          <div className="flex items-center gap-2 text-ash">
            <Spinner /> Loading…
          </div>
        ) : null}
        {rows?.length === 0 ? <p className="panel p-6 text-center text-ash">No ranked players yet. Be the first.</p> : null}
        {rows && rows.length > 0 ? (
          <div className="panel overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-ash">
                <tr className="border-b border-stone-700">
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Player</th>
                  <th className="px-4 py-3 text-right font-semibold">Elo</th>
                  <th className="hidden px-4 py-3 text-right font-semibold sm:table-cell">W / L / D</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const me = user?.username === r.username;
                  return (
                    <tr key={r.username} className={`border-b border-stone-800 last:border-0 ${me ? 'bg-shadow/10' : ''}`}>
                      <td className={`px-4 py-3 font-display font-extrabold tabular-nums ${r.rank <= 3 ? 'text-gold' : 'text-ash'}`}>{r.rank}</td>
                      <td className="px-4 py-3 font-medium">
                        {r.username}
                        {me ? <span className="ml-2 rounded bg-shadow/30 px-1.5 py-0.5 text-xs text-shadow-bright">you</span> : null}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{r.elo}</td>
                      <td className="hidden px-4 py-3 text-right tabular-nums text-ash sm:table-cell">
                        {r.wins} / {r.losses} / {r.draws}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {more ? (
          <Button variant="secondary" disabled={loading} onClick={() => load(rows?.length ?? 0)} className="w-full">
            {loading ? <Spinner /> : null} Show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
