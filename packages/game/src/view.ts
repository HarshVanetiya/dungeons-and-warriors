// What each player is allowed to see (GAME_RULES.md section 7): the opponent's powerups are hidden.
// Only the count shows, and anything activated this round stays in that count until the roll.

import type { HeroId } from './heroes.js';
import type { MatchEvent, MatchResult, MatchState, PlayerIndex, PlayerState, RoundResult } from './match.js';

export interface OpponentView {
  heroId: HeroId;
  hp: number;
  energy: number;
  heldCount: number;
}

export interface MatchView {
  status: MatchState['status'];
  round: number;
  attacker: PlayerIndex;
  you: PlayerIndex;
  me: PlayerState;
  opponent: OpponentView;
  drawOffer: { by: PlayerIndex } | null;
  /** True when you are attacking and may offer a draw right now. */
  canOfferDraw: boolean;
  rounds: RoundResult[];
  result: MatchResult | null;
}

export function viewFor(state: MatchState, viewer: PlayerIndex): MatchView {
  const me = state.players[viewer];
  const opp = state.players[viewer === 0 ? 1 : 0];
  return {
    status: state.status,
    round: state.round,
    attacker: state.attacker,
    you: viewer,
    me: { ...me, held: [...me.held], offer: me.offer ? [...me.offer] : null, active: [...me.active] },
    opponent: { heroId: opp.heroId, hp: opp.hp, energy: opp.energy, heldCount: opp.held.length + opp.active.length },
    drawOffer: state.drawOffer ? { ...state.drawOffer } : null,
    canOfferDraw: state.status === 'active' && state.attacker === viewer && state.canOfferDraw && !state.drawOffer,
    rounds: state.rounds,
    result: state.result,
  };
}

export type ViewerEvent = MatchEvent | { type: 'opponentPickedPowerup'; player: PlayerIndex };

/** The version of `event` that `viewer` may receive, or null if they must not see it at all. */
export function eventFor(event: MatchEvent, viewer: PlayerIndex): ViewerEvent | null {
  switch (event.type) {
    case 'powerupOffered':
    case 'powerupActivated':
      return event.player === viewer ? event : null;
    case 'powerupPicked':
      return event.player === viewer ? event : { type: 'opponentPickedPowerup', player: event.player };
    default:
      return event;
  }
}
