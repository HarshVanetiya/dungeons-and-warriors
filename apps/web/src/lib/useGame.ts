'use client';

// The live-match connection (apps/server/README.md, "Socket.IO protocol").

import type {
  AckResponse,
  ClientAction,
  ClientToServer,
  HeroId,
  MatchEnded,
  MatchFound,
  MatchUpdate,
  ServerToClient,
} from '@dungeon-drill/game';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api } from './api';

export type Connection = 'connecting' | 'connected' | 'reconnecting' | 'replaced' | 'unauthorized';

export interface GameState {
  connection: Connection;
  queued: boolean;
  found: MatchFound | null;
  update: MatchUpdate | null;
  ended: MatchEnded | null;
  /** Local clock minus server clock, to show timers correctly. */
  clockOffset: number;
}

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? 'http://localhost:4000';

export function useGame() {
  const socketRef = useRef<Socket<ServerToClient, ClientToServer> | null>(null);
  const [state, setState] = useState<GameState>({
    connection: 'connecting',
    queued: false,
    found: null,
    update: null,
    ended: null,
    clockOffset: 0,
  });

  useEffect(() => {
    const socket: Socket<ServerToClient, ClientToServer> = io(SOCKET_URL, {
      // a fresh 60-second token for every (re)connection
      auth: (cb) => {
        void api<{ token: string }>('/auth/socket-token', { method: 'POST' }).then((res) => cb({ token: res.ok ? res.data.token : '' }));
      },
      transports: ['websocket'],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on('connect', () => setState((s) => ({ ...s, connection: 'connected' })));
    socket.on('disconnect', (reason) => {
      setState((s) => (s.connection === 'replaced' ? s : { ...s, connection: 'reconnecting', queued: false }));
      // the server closed it on purpose (another tab took over): don't fight it
      if (reason === 'io server disconnect') socket.disconnect();
    });
    socket.on('connect_error', (err) => {
      if (err.message === 'unauthorized') setState((s) => ({ ...s, connection: 'unauthorized' }));
    });
    socket.on('session:replaced', () => setState((s) => ({ ...s, connection: 'replaced', queued: false })));
    socket.on('match:found', (found) =>
      setState((s) => ({ ...s, queued: false, found, ended: s.found?.matchId === found.matchId ? s.ended : null, update: s.update?.matchId === found.matchId ? s.update : null })),
    );
    socket.on('match:update', (update) => setState((s) => ({ ...s, update, clockOffset: Date.now() - update.timers.serverNow })));
    socket.on('match:ended', (ended) => setState((s) => ({ ...s, ended })));

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  const queue = useCallback(
    (heroId: HeroId) =>
      new Promise<AckResponse>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) return resolve({ ok: false, error: 'disconnected' });
        socket.emit('queue:join', { heroId }, (res) => {
          if (res.ok) setState((s) => ({ ...s, queued: s.found && !s.ended ? s.queued : true }));
          resolve(res);
        });
      }),
    [],
  );

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('queue:leave');
    setState((s) => ({ ...s, queued: false }));
  }, []);

  const act = useCallback(
    (action: ClientAction) =>
      new Promise<AckResponse>((resolve) => {
        const socket = socketRef.current;
        if (!socket?.connected) return resolve({ ok: false, error: 'disconnected' });
        socket.emit('match:action', action, resolve);
      }),
    [],
  );

  /** Leave the results screen and go back to the lobby. */
  const backToLobby = useCallback(() => setState((s) => ({ ...s, found: null, update: null, ended: null })), []);

  /** Take over again after another tab replaced this one. */
  const reclaim = useCallback(() => {
    setState((s) => ({ ...s, connection: 'connecting' }));
    socketRef.current?.connect();
  }, []);

  return { ...state, queue, leaveQueue, act, backToLobby, reclaim };
}

export type Game = ReturnType<typeof useGame>;
