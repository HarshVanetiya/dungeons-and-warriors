// The match state machine: GAME_RULES.md sections 3, 4, 5 and 7.
// Every function is pure: it returns a new state and never touches the one passed in.
// Timers (30-second turns, draw answers, reconnects) live on the server, which turns them into
// `forfeit` / `respondDraw` actions.

import { HEROES, type Hero, type HeroId } from './heroes.js';
import {
  ENERGY_MAX,
  MAX_HELD_POWERUPS,
  POWERUPS,
  POWERUP_IDS,
  attackValue,
  defenseValue,
  energyForDamage,
  secondWindHeal,
  type PowerupId,
} from './powerups.js';
import type { Rng } from './rng.js';

export type PlayerIndex = 0 | 1;

/** After a rejected draw offer, the player who offered can't offer again for this many of their attacking turns. */
export const DRAW_OFFER_COOLDOWN_TURNS = 3;

export interface PlayerState {
  heroId: HeroId;
  hp: number;
  energy: number;
  /** Powerups ready to use. Hidden from the opponent, who only sees the count. */
  held: PowerupId[];
  /** Two powerups offered after the energy meter filled; the player keeps one. */
  offer: [PowerupId, PowerupId] | null;
  /** Powerups activated for the current round, applied when the attacker presses Attack. */
  active: PowerupId[];
  /** Attacking turns left during which this player can't offer a draw. */
  drawCooldown: number;
}

export type ForfeitReason = 'exit' | 'timeout' | 'disconnect';

export type MatchResult =
  | { kind: 'knockout' | ForfeitReason; winner: PlayerIndex }
  | { kind: 'draw' };

export interface RoundResult {
  round: number;
  attacker: PlayerIndex;
  attackRoll: number;
  defenseRoll: number;
  /** Rolls after powerups (stacking rule). */
  attackValue: number;
  defenseValue: number;
  attackerPowerups: PowerupId[];
  defenderPowerups: PowerupId[];
  /** HP actually lost by the defender (attack) and by the attacker (counter damage). */
  damageToDefender: number;
  damageToAttacker: number;
  /** HP healed by each player this round (Second Wind, Vampiric Edge). */
  healed: [number, number];
  hpAfter: [number, number];
  energyAfter: [number, number];
}

export interface MatchState {
  status: 'active' | 'finished';
  /** Current round, starting at 1. */
  round: number;
  attacker: PlayerIndex;
  players: [PlayerState, PlayerState];
  drawOffer: { by: PlayerIndex } | null;
  /** Whether the current attacker may still offer a draw this turn. */
  canOfferDraw: boolean;
  /** Every resolved round, in order. Used for match history and the end-of-match fight scene. */
  rounds: RoundResult[];
  result: MatchResult | null;
}

export type MatchAction =
  | { type: 'activatePowerup'; player: PlayerIndex; powerup: PowerupId }
  | { type: 'pickPowerup'; player: PlayerIndex; powerup: PowerupId }
  | { type: 'attack'; player: PlayerIndex }
  | { type: 'offerDraw'; player: PlayerIndex }
  | { type: 'respondDraw'; player: PlayerIndex; accept: boolean }
  | { type: 'forfeit'; player: PlayerIndex; reason: ForfeitReason };

export type MatchEvent =
  | { type: 'turnStarted'; round: number; attacker: PlayerIndex }
  | { type: 'powerupOffered'; player: PlayerIndex; options: [PowerupId, PowerupId] }
  | { type: 'powerupPicked'; player: PlayerIndex; powerup: PowerupId; auto: boolean }
  | { type: 'powerupActivated'; player: PlayerIndex; powerup: PowerupId }
  | { type: 'roundResolved'; result: RoundResult }
  | { type: 'drawOffered'; by: PlayerIndex }
  | { type: 'drawRejected'; by: PlayerIndex }
  | { type: 'matchEnded'; result: MatchResult };

export type ActionError =
  | 'matchFinished'
  | 'notYourTurn'
  | 'drawOfferPending'
  | 'noDrawOffer'
  | 'cannotOfferDraw'
  | 'powerupNotHeld'
  | 'wrongTimingForPowerup'
  | 'powerupAlreadyActive'
  | 'noPowerupOffer'
  | 'powerupNotOffered';

export type ActionResult =
  | { ok: true; state: MatchState; events: MatchEvent[] }
  | { ok: false; error: ActionError };

export const other = (p: PlayerIndex): PlayerIndex => (p === 0 ? 1 : 0);
export const heroOf = (player: PlayerState): Hero => HEROES[player.heroId];

/** Start a match. The coin flip for the first attacker uses `rng`. */
export function createMatch(heroes: [HeroId, HeroId], rng: Rng): { state: MatchState; events: MatchEvent[] } {
  const newPlayer = (heroId: HeroId): PlayerState => ({
    heroId,
    hp: HEROES[heroId].maxHp,
    energy: 0,
    held: [],
    offer: null,
    active: [],
    drawCooldown: 0,
  });
  const state: MatchState = {
    status: 'active',
    round: 1,
    attacker: rng.int(0, 1) as PlayerIndex,
    players: [newPlayer(heroes[0]), newPlayer(heroes[1])],
    drawOffer: null,
    canOfferDraw: false,
    rounds: [],
    result: null,
  };
  const events: MatchEvent[] = [];
  startTurn(state, rng, events);
  return { state, events };
}

export function applyAction(current: MatchState, action: MatchAction, rng: Rng): ActionResult {
  if (current.status === 'finished') return fail('matchFinished');
  const state = cloneState(current);
  const events: MatchEvent[] = [];
  const error = run(state, action, rng, events);
  return error ? fail(error) : { ok: true, state, events };
}

function run(state: MatchState, action: MatchAction, rng: Rng, events: MatchEvent[]): ActionError | null {
  const me = state.players[action.player];
  switch (action.type) {
    case 'activatePowerup': {
      const { timing } = POWERUPS[action.powerup];
      const attacking = action.player === state.attacker;
      if ((timing === 'attack' && !attacking) || (timing === 'defense' && attacking)) return 'wrongTimingForPowerup';
      if (me.active.includes(action.powerup)) return 'powerupAlreadyActive';
      const i = me.held.indexOf(action.powerup);
      if (i < 0) return 'powerupNotHeld';
      me.held.splice(i, 1);
      me.active.push(action.powerup);
      events.push({ type: 'powerupActivated', player: action.player, powerup: action.powerup });
      maybeOfferPowerup(state, action.player, rng, events); // a slot just freed up
      return null;
    }
    case 'pickPowerup': {
      if (!me.offer) return 'noPowerupOffer';
      if (!me.offer.includes(action.powerup)) return 'powerupNotOffered';
      pick(state, action.player, action.powerup, false, rng, events);
      return null;
    }
    case 'attack': {
      if (action.player !== state.attacker) return 'notYourTurn';
      if (state.drawOffer) return 'drawOfferPending';
      resolveRound(state, rng, events);
      return null;
    }
    case 'offerDraw': {
      if (action.player !== state.attacker) return 'notYourTurn';
      if (state.drawOffer) return 'drawOfferPending';
      if (!state.canOfferDraw) return 'cannotOfferDraw';
      state.drawOffer = { by: action.player };
      state.canOfferDraw = false; // one offer per turn
      events.push({ type: 'drawOffered', by: action.player });
      return null;
    }
    case 'respondDraw': {
      if (!state.drawOffer || state.drawOffer.by === action.player) return 'noDrawOffer';
      const by = state.drawOffer.by;
      state.drawOffer = null;
      if (action.accept) {
        finish(state, { kind: 'draw' }, events);
      } else {
        state.players[by].drawCooldown = DRAW_OFFER_COOLDOWN_TURNS;
        events.push({ type: 'drawRejected', by });
      }
      return null;
    }
    case 'forfeit': {
      finish(state, { kind: action.reason, winner: other(action.player) }, events);
      return null;
    }
  }
}

function resolveRound(state: MatchState, rng: Rng, events: MatchEvent[]): void {
  const a = state.attacker;
  const d = other(a);
  const att = state.players[a];
  const def = state.players[d];
  const attHero = heroOf(att);
  const defHero = heroOf(def);
  const healed: [number, number] = [0, 0];

  const attackRoll = rng.int(1, attHero.attackScore);
  const defenseRoll = rng.int(1, defHero.defenseScore);

  for (const p of [a, d]) {
    const player = state.players[p];
    if (player.active.includes('secondWind')) healed[p] += heal(player, secondWindHeal(heroOf(player)));
  }

  const aValue = attackValue(attackRoll, attHero, att.active);
  const dValue = defenseValue(defenseRoll, defHero, def.active);
  const diff = aValue - dValue;
  let damageToDefender = 0;
  let damageToAttacker = 0;

  if (diff > 0) {
    damageToDefender = hurt(state, d, diff, rng, events);
    if (att.active.includes('vampiricEdge')) healed[a] += heal(att, Math.floor(damageToDefender / 2));
  } else if (diff < 0) {
    const counter = def.active.includes('thorns') ? -2 * diff : -diff;
    damageToAttacker = hurt(state, a, counter, rng, events);
  }

  const result: RoundResult = {
    round: state.round,
    attacker: a,
    attackRoll,
    defenseRoll,
    attackValue: aValue,
    defenseValue: dValue,
    attackerPowerups: att.active,
    defenderPowerups: def.active,
    damageToDefender,
    damageToAttacker,
    healed,
    hpAfter: [state.players[0].hp, state.players[1].hp],
    energyAfter: [state.players[0].energy, state.players[1].energy],
  };
  att.active = [];
  def.active = [];
  state.rounds.push(result);
  events.push({ type: 'roundResolved', result });

  if (def.hp === 0 || att.hp === 0) {
    finish(state, { kind: 'knockout', winner: def.hp === 0 ? a : d }, events);
    return;
  }
  state.round += 1;
  state.attacker = d;
  startTurn(state, rng, events);
}

function startTurn(state: MatchState, rng: Rng, events: MatchEvent[]): void {
  const p = state.attacker;
  const player = state.players[p];
  state.drawOffer = null;
  state.canOfferDraw = player.drawCooldown === 0;
  if (player.drawCooldown > 0) player.drawCooldown -= 1;
  events.push({ type: 'turnStarted', round: state.round, attacker: p });
  // an offer not picked by the start of your next attacking turn is picked for you
  if (player.offer) pick(state, p, player.offer[rng.int(0, 1)]!, true, rng, events);
}

/** Deal `amount` damage to `victim`, give both players energy, and return the HP actually lost. */
function hurt(state: MatchState, victim: PlayerIndex, amount: number, rng: Rng, events: MatchEvent[]): number {
  const player = state.players[victim];
  const lost = Math.min(player.hp, amount);
  player.hp -= lost;
  const [taken, dealt] = energyForDamage(lost, heroOf(player).maxHp);
  addEnergy(state, victim, taken, rng, events);
  addEnergy(state, other(victim), dealt, rng, events);
  return lost;
}

function heal(player: PlayerState, amount: number): number {
  const gained = Math.min(amount, heroOf(player).maxHp - player.hp);
  player.hp += gained;
  return gained;
}

function addEnergy(state: MatchState, p: PlayerIndex, amount: number, rng: Rng, events: MatchEvent[]): void {
  state.players[p].energy += amount;
  maybeOfferPowerup(state, p, rng, events);
}

/** A full meter turns into an offer when there is a free slot and no offer waiting; otherwise it stays at 100. */
function maybeOfferPowerup(state: MatchState, p: PlayerIndex, rng: Rng, events: MatchEvent[]): void {
  const player = state.players[p];
  if (player.energy >= ENERGY_MAX && !player.offer && player.held.length < MAX_HELD_POWERUPS) {
    player.energy -= ENERGY_MAX;
    const first = rng.int(0, POWERUP_IDS.length - 1);
    const second = (first + rng.int(1, POWERUP_IDS.length - 1)) % POWERUP_IDS.length;
    player.offer = [POWERUP_IDS[first]!, POWERUP_IDS[second]!];
    events.push({ type: 'powerupOffered', player: p, options: player.offer });
  }
  player.energy = Math.min(player.energy, ENERGY_MAX);
}

function pick(state: MatchState, p: PlayerIndex, powerup: PowerupId, auto: boolean, rng: Rng, events: MatchEvent[]): void {
  const player = state.players[p];
  player.held.push(powerup);
  player.offer = null;
  events.push({ type: 'powerupPicked', player: p, powerup, auto });
  maybeOfferPowerup(state, p, rng, events); // energy may have refilled while the offer was waiting
}

function finish(state: MatchState, result: MatchResult, events: MatchEvent[]): void {
  state.status = 'finished';
  state.result = result;
  state.drawOffer = null;
  events.push({ type: 'matchEnded', result });
}

function fail(error: ActionError): ActionResult {
  return { ok: false, error };
}

function cloneState(s: MatchState): MatchState {
  const clonePlayer = (p: PlayerState): PlayerState => ({
    ...p,
    held: [...p.held],
    offer: p.offer ? [...p.offer] : null,
    active: [...p.active],
  });
  return {
    ...s,
    players: [clonePlayer(s.players[0]), clonePlayer(s.players[1])],
    drawOffer: s.drawOffer ? { ...s.drawOffer } : null,
    rounds: [...s.rounds], // RoundResults are never changed after they're recorded
  };
}
