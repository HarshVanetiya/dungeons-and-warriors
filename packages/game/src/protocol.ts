// Socket.IO messages between the web app and the server (apps/server/README.md).
// Types only: the server validates incoming messages with zod.

import type { HeroId } from './heroes.js';
import type { MatchResult, PlayerIndex, RoundResult } from './match.js';
import type { PowerupId } from './powerups.js';
import type { MatchView, ViewerEvent } from './view.js';

/** What a client may ask for. The server fills in which player they are; clients never choose. */
export type ClientAction =
  | { type: 'attack' }
  | { type: 'offerDraw' }
  | { type: 'respondDraw'; accept: boolean }
  | { type: 'activatePowerup'; powerup: PowerupId }
  | { type: 'pickPowerup'; powerup: PowerupId }
  | { type: 'exit' };

export interface PlayerInfo {
  username: string;
  elo: number;
  heroId: HeroId;
}

export interface MatchFound {
  matchId: string;
  you: PlayerIndex;
  players: [PlayerInfo, PlayerInfo];
}

export interface Timers {
  /** Server clock when this was sent, so clients can correct for clock differences. */
  serverNow: number;
  /** When the attacker loses for not pressing Attack. Null while paused for a draw offer. */
  turnEndsAt: number | null;
  /** When an unanswered draw offer counts as rejected. */
  drawAnswerEndsAt: number | null;
  /** When a disconnected player loses, per player. */
  reconnectEndsAt: [number | null, number | null];
}

export interface MatchUpdate {
  matchId: string;
  view: MatchView;
  events: ViewerEvent[];
  timers: Timers;
}

export interface EloChangeInfo {
  before: number;
  after: number;
  delta: number;
}

export interface MatchEnded {
  matchId: string;
  result: MatchResult;
  /** Your rating before and after. Null if saving the result failed. */
  elo: EloChangeInfo | null;
  /** Every round, for the end-of-match fight scene. */
  rounds: RoundResult[];
}

export type AckResponse = { ok: true } | { ok: false; error: string };
export type Ack = (response: AckResponse) => void;

export interface ServerToClient {
  'match:found': (m: MatchFound) => void;
  'match:update': (u: MatchUpdate) => void;
  'match:ended': (e: MatchEnded) => void;
  'session:replaced': () => void;
}

export interface ClientToServer {
  'queue:join': (payload: { heroId: HeroId }, ack?: Ack) => void;
  'queue:leave': (ack?: Ack) => void;
  'match:action': (payload: ClientAction, ack?: Ack) => void;
}
