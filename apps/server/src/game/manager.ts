// Matchmaking queue and the registry of live matches. Everything lives in memory, which is fine
// for one server (GAME_RULES.md section 10). Running more than one server needs Redis.

import { applyElo, canMatch, secureRng, type HeroId, type MatchResult, type Rng } from '@dungeon-drill/game';
import type { Timings } from '../config.js';
import type { Db } from '../db.js';
import type { MatchResultKind } from '../generated/prisma/client.js';
import { LiveMatch, type EloResult } from './liveMatch.js';
import type { ClientAction } from './protocol.js';
import type { GameSocket } from './socket.js';

interface QueueEntry {
  userId: string;
  username: string;
  elo: number;
  heroId: HeroId;
}

const RESULT_KIND: Record<MatchResult['kind'], MatchResultKind> = {
  knockout: 'KNOCKOUT',
  exit: 'EXIT',
  timeout: 'TIMEOUT',
  disconnect: 'DISCONNECT',
  draw: 'DRAW',
};

export class MatchManager {
  /** Each user's current socket. A newer connection replaces an older one. */
  private readonly sockets = new Map<string, GameSocket>();
  /** Waiting players, oldest first (Map keeps insertion order). */
  private readonly queue = new Map<string, QueueEntry>();
  private readonly matches = new Map<string, LiveMatch>();

  constructor(
    private readonly db: Db,
    private readonly timings: Timings,
    private readonly rng: Rng = secureRng(),
  ) {}

  onConnect(socket: GameSocket): void {
    const { userId } = socket.data;
    const previous = this.sockets.get(userId);
    this.sockets.set(userId, socket);
    if (previous && previous.id !== socket.id) {
      previous.emit('session:replaced');
      previous.disconnect(true);
    }
    this.matches.get(userId)?.playerReconnected(userId);
  }

  onDisconnect(socket: GameSocket): void {
    const { userId } = socket.data;
    if (this.sockets.get(userId) !== socket) return; // already replaced by a newer connection
    this.sockets.delete(userId);
    this.queue.delete(userId);
    this.matches.get(userId)?.playerDisconnected(userId);
  }

  /** Queue up, or start a match straight away with the longest-waiting player within Elo range. */
  async joinQueue(userId: string, heroId: HeroId): Promise<string | null> {
    if (this.matches.has(userId)) return 'alreadyInMatch';
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { username: true, elo: true } });
    if (!user) return 'notLoggedIn';
    // things may have changed while reading the database
    if (this.matches.has(userId)) return 'alreadyInMatch';
    if (!this.sockets.has(userId)) return 'disconnected';

    this.queue.delete(userId);
    const me: QueueEntry = { userId, heroId, ...user };
    for (const waiting of this.queue.values()) {
      if (canMatch(me.elo, waiting.elo)) {
        this.queue.delete(waiting.userId);
        this.startMatch(waiting, me);
        return null;
      }
    }
    this.queue.set(userId, me);
    return null;
  }

  leaveQueue(userId: string): void {
    this.queue.delete(userId);
  }

  isQueued(userId: string): boolean {
    return this.queue.has(userId);
  }

  act(userId: string, action: ClientAction): string | null {
    const match = this.matches.get(userId);
    return match ? match.act(userId, action) : 'notInMatch';
  }

  /** Live matches, for tests and graceful shutdown. */
  liveMatchCount(): number {
    return new Set(this.matches.values()).size;
  }

  private startMatch(a: QueueEntry, b: QueueEntry): void {
    const toSeat = ({ userId, username, elo, heroId }: QueueEntry) => ({ userId, username, elo, heroId });
    const match = new LiveMatch([toSeat(a), toSeat(b)], {
      rng: this.rng,
      timings: this.timings,
      socketOf: (id) => this.sockets.get(id),
      onFinish: (m) => this.saveResult(m),
    });
    // the match may already be over if both players vanished; only register it while it's running
    if (match.state.status === 'active') {
      this.matches.set(a.userId, match);
      this.matches.set(b.userId, match);
    }
  }

  /** Update both ratings and records and store the match, in one transaction. */
  private async saveResult(match: LiveMatch): Promise<[EloResult, EloResult]> {
    const [a, b] = match.seats;
    const result = match.state.result!;
    try {
      return await this.db.$transaction(async (tx) => {
        const users = await tx.user.findMany({ where: { id: { in: [a.userId, b.userId] } }, select: { id: true, elo: true } });
        const eloA = users.find((u) => u.id === a.userId)!.elo;
        const eloB = users.find((u) => u.id === b.userId)!.elo;
        const outcome = result.kind === 'draw' ? 'draw' : result.winner === 0 ? 'aWins' : 'bWins';
        const change = applyElo(eloA, eloB, outcome);
        const record = (won: boolean) =>
          outcome === 'draw' ? { draws: { increment: 1 } } : won ? { wins: { increment: 1 } } : { losses: { increment: 1 } };

        await tx.user.update({ where: { id: a.userId }, data: { elo: change.a, ...record(outcome === 'aWins') } });
        await tx.user.update({ where: { id: b.userId }, data: { elo: change.b, ...record(outcome === 'bWins') } });
        await tx.match.create({
          data: {
            playerAId: a.userId,
            playerBId: b.userId,
            heroA: a.heroId,
            heroB: b.heroId,
            result: RESULT_KIND[result.kind],
            winnerId: result.kind === 'draw' ? null : match.seats[result.winner].userId,
            eloBeforeA: eloA,
            eloBeforeB: eloB,
            eloDeltaA: change.deltaA,
            rounds: match.state.rounds as object[],
            startedAt: match.startedAt,
          },
        });
        return [
          { before: eloA, after: change.a, delta: change.deltaA },
          { before: eloB, after: change.b, delta: -change.deltaA },
        ];
      });
    } catch (err) {
      console.error(`[match ${match.id}] failed to save result`, err);
      return [null, null];
    } finally {
      // only now may these players queue again, so they queue with their new rating
      this.matches.delete(a.userId);
      this.matches.delete(b.userId);
    }
  }
}
