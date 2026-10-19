// Socket.IO messages between the web app and the server.

import { HERO_IDS, POWERUP_IDS, type HeroId, type PowerupId, type MatchResult, type MatchView, type PlayerIndex, type RoundResult, type ViewerEvent } from '@dungeon-drill/game';
import { z } from 'zod';

const heroId = z.enum(HERO_IDS as [HeroId, ...HeroId[]]);
const powerup = z.enum(POWERUP_IDS as [PowerupId, ...PowerupId[]]);

export const QueueJoin = z.object({ heroId });

/** What a client may ask for. The server fills in which player they are; clients never choose. */
export const ClientAction = z.discriminatedUnion('type', [
  z.object({ type: z.literal('attack') }),
  z.object({ type: z.literal('offerDraw') }),
  z.object({ type: z.literal('respondDraw'), accept: z.boolean() }),
  z.object({ type: z.literal('activatePowerup'), powerup }),
  z.object({ type: z.literal('pickPowerup'), powerup }),
  z.object({ type: z.literal('exit') }),
]);
export type ClientAction = z.infer<typeof ClientAction>;

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

export interface MatchEnded {
  matchId: string;
  result: MatchResult;
  /** Your rating before and after. Null if saving the result failed. */
  elo: { before: number; after: number; delta: number } | null;
  /** Every round, for the end-of-match fight scene. */
  rounds: RoundResult[];
}

export type Ack<T = object> = (response: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ServerToClient {
  'match:found': (m: MatchFound) => void;
  'match:update': (u: MatchUpdate) => void;
  'match:ended': (e: MatchEnded) => void;
  'session:replaced': () => void;
}

export interface ClientToServer {
  'queue:join': (payload: unknown, ack?: Ack) => void;
  'queue:leave': (ack?: Ack) => void;
  'match:action': (payload: unknown, ack?: Ack) => void;
}
