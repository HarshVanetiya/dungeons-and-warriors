import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { createServer } from '../src/app.js';
import type { Config, Timings } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';
import type { Email } from '../src/email.js';
import type { ClientToServer, MatchEnded, MatchFound, MatchUpdate, ServerToClient } from '../src/game/protocol.js';
import { hashPassword } from '../src/auth/passwords.js';
import type { HeroId } from '@dungeon-drill/game';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasDb = Boolean(TEST_DATABASE_URL);

export const testConfig: Config = {
  NODE_ENV: 'test',
  PORT: 0,
  DATABASE_URL: TEST_DATABASE_URL ?? '',
  JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-characters',
  SOCKET_TOKEN_SECRET: 'test-socket-secret-that-is-at-least-32-chars',
  WEB_ORIGIN: 'http://localhost:3000',
  EMAIL_MODE: 'log',
  EMAIL_FROM: 'test@example.com',
  TRUST_PROXY_HOPS: 0,
};

export const FAST_TIMINGS: Timings = { turnMs: 400, drawAnswerMs: 300, reconnectMs: 300 };

let sharedDb: Db | null = null;
export function testDb(): Db {
  sharedDb ??= createDb(TEST_DATABASE_URL!);
  return sharedDb;
}

export async function resetDb(): Promise<void> {
  await testDb().$executeRawUnsafe('TRUNCATE "Match", "EmailCode", "User" CASCADE');
}

export async function startServer(timings: Timings = FAST_TIMINGS) {
  const outbox: Email[] = [];
  const server = createServer({
    config: testConfig,
    db: testDb(),
    email: { send: async (e) => void outbox.push(e) },
    timings,
    rateLimit: false,
  });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  const url = `http://localhost:${(server.httpServer.address() as AddressInfo).port}`;
  return {
    ...server,
    url,
    outbox,
    /** The 6-digit code in the latest email sent to `to`. */
    lastCode(to: string): string {
      const mail = outbox.filter((e) => e.to === to).at(-1);
      const code = mail?.text.match(/\b(\d{6})\b/)?.[1];
      if (!code) throw new Error(`no code emailed to ${to}`);
      return code;
    },
    close: () => new Promise<void>((resolve) => server.io.close(() => resolve())),
  };
}

export type TestServer = Awaited<ReturnType<typeof startServer>>;

/** A verified user created straight in the database. */
export async function createUser(username: string, elo = 1200) {
  return testDb().user.create({
    data: { email: `${username.toLowerCase()}@example.com`, username, passwordHash: await hashPassword('password123'), emailVerified: true, elo },
  });
}

type ClientSocket = Socket<ServerToClient, ClientToServer>;

/** A connected game client that records everything the server sends. */
export async function player(server: TestServer, user: { id: string; sessionVersion: number }) {
  const socket: ClientSocket = connect(server.url, {
    auth: { token: server.sessions.socketToken(user) },
    transports: ['websocket'],
    reconnection: false,
    forceNew: true,
  });
  const found: MatchFound[] = [];
  const updates: MatchUpdate[] = [];
  const ended: MatchEnded[] = [];
  socket.on('match:found', (m) => void found.push(m));
  socket.on('match:update', (u) => void updates.push(u));
  socket.on('match:ended', (e) => void ended.push(e));
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });

  const emit = (event: 'queue:join' | 'match:action', payload: unknown) =>
    // untyped on purpose: tests also send invalid payloads
    new Promise<{ ok: boolean; error?: string }>((resolve) => (socket as unknown as Socket).emit(event, payload, resolve));

  return {
    socket,
    found,
    updates,
    ended,
    latest: () => updates.at(-1)!,
    queue: (heroId: HeroId) => emit('queue:join', { heroId }),
    action: (payload: object) => emit('match:action', payload),
  };
}

/** Poll until `get` returns something other than undefined, null or false. */
export async function waitFor<T>(get: () => T | undefined | null | false, timeoutMs = 3000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = get();
    if (value !== undefined && value !== null && value !== false) return value;
    if (Date.now() - start > timeoutMs) throw new Error('timed out waiting');
    await new Promise((r) => setTimeout(r, 10));
  }
}
