// One running match: applies actions through the game engine, runs the timers from
// GAME_RULES.md section 5, and sends each player only what they may see.

import {
  applyAction,
  createMatch,
  eventFor,
  other,
  viewFor,
  type MatchAction,
  type MatchEvent,
  type MatchState,
  type PlayerIndex,
  type Rng,
} from '@dungeon-drill/game';
import { randomUUID } from 'node:crypto';
import type { Timings } from '../config.js';
import type { ClientAction, MatchEnded, PlayerInfo, Timers } from './protocol.js';
import type { GameSocket } from './socket.js';

export interface Seat extends PlayerInfo {
  userId: string;
}

export type EloResult = MatchEnded['elo'];

export interface LiveMatchDeps {
  rng: Rng;
  timings: Timings;
  socketOf: (userId: string) => GameSocket | undefined;
  /** Saves the result and returns each player's Elo change. Called once, when the match ends. */
  onFinish: (match: LiveMatch) => Promise<[EloResult, EloResult]>;
}

interface Countdown {
  timer: NodeJS.Timeout;
  endsAt: number;
}

export class LiveMatch {
  readonly id = randomUUID();
  readonly startedAt = new Date();
  state: MatchState;

  private turn: Countdown | null = null;
  /** The round the turn timer belongs to, and time left while it's paused for a draw offer. */
  private turnRound = 0;
  private turnRemainingMs = 0;
  private drawAnswer: Countdown | null = null;
  private reconnect: [Countdown | null, Countdown | null] = [null, null];
  private finished = false;

  constructor(
    readonly seats: [Seat, Seat],
    private readonly deps: LiveMatchDeps,
  ) {
    const { state, events } = createMatch([seats[0].heroId, seats[1].heroId], deps.rng);
    this.state = state;
    for (const p of [0, 1] as const) this.sendFound(p);
    this.afterChange(events);
  }

  playerOf(userId: string): PlayerIndex {
    return this.seats[0].userId === userId ? 0 : 1;
  }

  /** Apply a player's action. Returns an error code, or null on success. */
  act(userId: string, action: ClientAction): string | null {
    const player = this.playerOf(userId);
    const mapped: MatchAction =
      action.type === 'exit' ? { type: 'forfeit', player, reason: 'exit' } : { ...action, player };
    return this.apply(mapped);
  }

  playerDisconnected(userId: string): void {
    if (this.finished) return;
    const p = this.playerOf(userId);
    clear(this.reconnect[p]);
    const endsAt = Date.now() + this.deps.timings.reconnectMs;
    this.reconnect[p] = {
      endsAt,
      timer: setTimeout(() => this.apply({ type: 'forfeit', player: p, reason: 'disconnect' }), this.deps.timings.reconnectMs),
    };
    this.sendUpdate(other(p), []);
  }

  playerReconnected(userId: string): void {
    if (this.finished) return;
    const p = this.playerOf(userId);
    clear(this.reconnect[p]);
    this.reconnect[p] = null;
    this.sendFound(p);
    this.sendUpdate(p, []);
    this.sendUpdate(other(p), []);
  }

  private apply(action: MatchAction): string | null {
    if (this.finished) return 'matchFinished';
    const result = applyAction(this.state, action, this.deps.rng);
    if (!result.ok) return result.error;
    this.state = result.state;
    this.afterChange(result.events);
    return null;
  }

  private afterChange(events: MatchEvent[]): void {
    this.syncTimers();
    for (const p of [0, 1] as const) this.sendUpdate(p, events);
    if (this.state.status === 'finished') void this.finish();
  }

  private syncTimers(): void {
    const { timings } = this.deps;
    if (this.state.status === 'finished') {
      this.stopTurn();
      clear(this.drawAnswer);
      this.drawAnswer = null;
      return;
    }
    if (this.state.drawOffer) {
      // the attacker's turn timer pauses while the other player decides
      if (!this.drawAnswer) {
        if (this.turn) this.turnRemainingMs = Math.max(0, this.turn.endsAt - Date.now());
        this.stopTurn();
        const answerer = other(this.state.drawOffer.by);
        this.drawAnswer = {
          endsAt: Date.now() + timings.drawAnswerMs,
          timer: setTimeout(() => this.apply({ type: 'respondDraw', player: answerer, accept: false }), timings.drawAnswerMs),
        };
      }
      return;
    }
    clear(this.drawAnswer);
    this.drawAnswer = null;
    if (this.turnRound !== this.state.round) {
      this.turnRound = this.state.round;
      this.startTurn(timings.turnMs);
    } else if (!this.turn) {
      this.startTurn(this.turnRemainingMs);
    }
  }

  private startTurn(ms: number): void {
    this.stopTurn();
    const attacker = this.state.attacker;
    this.turn = {
      endsAt: Date.now() + ms,
      timer: setTimeout(() => this.apply({ type: 'forfeit', player: attacker, reason: 'timeout' }), ms),
    };
  }

  private stopTurn(): void {
    clear(this.turn);
    this.turn = null;
  }

  private async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    for (const r of this.reconnect) clear(r);
    const elo = await this.deps.onFinish(this);
    for (const p of [0, 1] as const) {
      const ended: MatchEnded = { matchId: this.id, result: this.state.result!, elo: elo[p], rounds: this.state.rounds };
      this.socket(p)?.emit('match:ended', ended);
    }
  }

  private timers(): Timers {
    return {
      serverNow: Date.now(),
      turnEndsAt: this.turn?.endsAt ?? null,
      drawAnswerEndsAt: this.drawAnswer?.endsAt ?? null,
      reconnectEndsAt: [this.reconnect[0]?.endsAt ?? null, this.reconnect[1]?.endsAt ?? null],
    };
  }

  private sendFound(p: PlayerIndex): void {
    const [a, b] = this.seats;
    const info = (s: Seat): PlayerInfo => ({ username: s.username, elo: s.elo, heroId: s.heroId });
    this.socket(p)?.emit('match:found', { matchId: this.id, you: p, players: [info(a), info(b)] });
  }

  private sendUpdate(p: PlayerIndex, events: MatchEvent[]): void {
    this.socket(p)?.emit('match:update', {
      matchId: this.id,
      view: viewFor(this.state, p),
      events: events.map((e) => eventFor(e, p)).filter((e) => e !== null),
      timers: this.timers(),
    });
  }

  private socket(p: PlayerIndex): GameSocket | undefined {
    return this.deps.socketOf(this.seats[p].userId);
  }
}

function clear(c: Countdown | null): void {
  if (c) clearTimeout(c.timer);
}
