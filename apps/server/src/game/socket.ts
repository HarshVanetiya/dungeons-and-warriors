import type { Server, Socket } from 'socket.io';
import type { Sessions } from '../auth/session.js';
import type { MatchManager } from './manager.js';
import type { Ack } from '@dungeon-drill/game';
import { ClientAction, QueueJoin, type ClientToServer, type ServerToClient } from './protocol.js';

export interface SocketData {
  userId: string;
}

export type GameServer = Server<ClientToServer, ServerToClient, Record<string, never>, SocketData>;
export type GameSocket = Socket<ClientToServer, ServerToClient, Record<string, never>, SocketData>;

export function attachSockets(io: GameServer, sessions: Sessions, manager: MatchManager): void {
  // the web app gets a 60-second token from POST /auth/socket-token and sends it here
  io.use(async (socket, next) => {
    const user = await sessions.userFromSocketToken(socket.handshake.auth?.token);
    if (!user) return next(new Error('unauthorized'));
    socket.data.userId = user.id;
    next();
  });

  io.on('connection', (socket) => {
    const { userId } = socket.data;
    manager.onConnect(socket);

    socket.on('queue:join', async (payload, ack) => {
      const reply = replier(ack);
      const parsed = QueueJoin.safeParse(payload);
      if (!parsed.success) return reply('invalidInput');
      reply(await manager.joinQueue(userId, parsed.data.heroId));
    });

    socket.on('queue:leave', (ack) => {
      manager.leaveQueue(userId);
      replier(ack)(null);
    });

    socket.on('match:action', (payload, ack) => {
      const reply = replier(ack);
      const parsed = ClientAction.safeParse(payload);
      if (!parsed.success) return reply('invalidInput');
      reply(manager.act(userId, parsed.data));
    });

    socket.on('disconnect', () => manager.onDisconnect(socket));
  });
}

function replier(ack: unknown): (error: string | null) => void {
  const fn = typeof ack === 'function' ? (ack as Ack) : () => {};
  return (error) => fn(error ? { ok: false, error } : { ok: true });
}
