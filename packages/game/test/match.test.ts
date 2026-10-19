import { describe, expect, it } from 'vitest';
import {
  DRAW_OFFER_COOLDOWN_TURNS,
  ENERGY_MAX,
  HEROES,
  HERO_IDS,
  MAX_HELD_POWERUPS,
  POWERUPS,
  applyAction,
  attackValue,
  createMatch,
  defenseValue,
  seededRng,
  type MatchAction,
  type MatchState,
  type PlayerIndex,
  type PowerupId,
} from '../src/index.js';
import { act, lastRound, newMatch, scriptedRng, tweak } from './helpers.js';

const KNIGHT = 0;
const MONK = 1;
/** Knight (player 0, attacks first) vs Monk (player 1). */
const knightVsMonk = () => newMatch(['knight', 'monk']);

describe('createMatch', () => {
  it('starts both heroes at full HP with empty meters', () => {
    const s = knightVsMonk();
    expect(s.players[0]).toMatchObject({ heroId: 'knight', hp: 60, energy: 0, held: [], offer: null });
    expect(s.players[1]).toMatchObject({ heroId: 'monk', hp: 61, energy: 0, held: [], offer: null });
    expect(s).toMatchObject({ status: 'active', round: 1, rounds: [], result: null });
  });

  it('flips a coin for the first attacker', () => {
    expect(createMatch(['knight', 'monk'], scriptedRng([0])).state.attacker).toBe(0);
    const { state, events } = createMatch(['knight', 'monk'], scriptedRng([1]));
    expect(state.attacker).toBe(1);
    expect(events).toEqual([{ type: 'turnStarted', round: 1, attacker: 1 }]);
  });
});

describe('rolling and damage (GAME_RULES.md section 4 examples)', () => {
  it('rolls attack 1..attackScore and defense 1..defenseScore', () => {
    // scriptedRng throws if the engine asks for a different range
    expect(() => act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [10, 1])).toThrow(/outside \[1, 9\]/);
    expect(() => act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [1, 12])).toThrow(/outside \[1, 11\]/);
  });

  it('hurts the defender when attack is higher: Knight 7 vs Monk 3', () => {
    const { state } = act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [7, 3]);
    expect(state.players[MONK].hp).toBe(57);
    expect(state.players[KNIGHT].hp).toBe(60);
    expect(lastRound(state)).toMatchObject({ damageToDefender: 4, damageToAttacker: 0 });
  });

  it('hurts the attacker when defense is higher (counter damage): Knight 5 vs Monk 10', () => {
    const { state } = act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [5, 10]);
    expect(state.players[KNIGHT].hp).toBe(55);
    expect(state.players[MONK].hp).toBe(61);
    expect(lastRound(state)).toMatchObject({ damageToDefender: 0, damageToAttacker: 5 });
  });

  it('does nothing on equal rolls', () => {
    const { state } = act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [6, 6]);
    expect(state.players.map((p) => p.hp)).toEqual([60, 61]);
  });

  it('swaps roles every round', () => {
    let s = knightVsMonk();
    s = act(s, { type: 'attack', player: KNIGHT }, [1, 1]).state;
    expect(s).toMatchObject({ round: 2, attacker: MONK });
    s = act(s, { type: 'attack', player: MONK }, [1, 1]).state;
    expect(s).toMatchObject({ round: 3, attacker: KNIGHT });
  });

  it('only lets the attacker attack', () => {
    expect(applyAction(knightVsMonk(), { type: 'attack', player: MONK }, scriptedRng([]))).toEqual({ ok: false, error: 'notYourTurn' });
  });

  it('never changes the state it was given', () => {
    const s = knightVsMonk();
    const before = structuredClone(s);
    act(s, { type: 'attack', player: KNIGHT }, [9, 1]);
    expect(s).toEqual(before);
  });
});

describe('end of match', () => {
  it('knocks out the defender, never going below 0 HP', () => {
    const s = tweak(knightVsMonk(), (s) => (s.players[MONK].hp = 3));
    const { state, events } = act(s, { type: 'attack', player: KNIGHT }, [9, 1]);
    expect(state.players[MONK].hp).toBe(0);
    expect(lastRound(state).damageToDefender).toBe(3);
    expect(state).toMatchObject({ status: 'finished', result: { kind: 'knockout', winner: KNIGHT } });
    expect(events.at(-1)).toEqual({ type: 'matchEnded', result: { kind: 'knockout', winner: KNIGHT } });
  });

  it('knocks out the attacker with counter damage', () => {
    const s = tweak(knightVsMonk(), (s) => (s.players[KNIGHT].hp = 2));
    const { state } = act(s, { type: 'attack', player: KNIGHT }, [1, 11]);
    expect(state.players[KNIGHT].hp).toBe(0);
    expect(state.result).toEqual({ kind: 'knockout', winner: MONK });
  });

  it.each(['exit', 'timeout', 'disconnect'] as const)('makes the player who %s lose', (reason) => {
    for (const player of [KNIGHT, MONK] as const) {
      const { state } = act(knightVsMonk(), { type: 'forfeit', player, reason });
      expect(state.result).toEqual({ kind: reason, winner: player === KNIGHT ? MONK : KNIGHT });
    }
  });

  it('rejects every action once the match is over', () => {
    const done = act(knightVsMonk(), { type: 'forfeit', player: MONK, reason: 'exit' }).state;
    const actions: MatchAction[] = [
      { type: 'attack', player: KNIGHT },
      { type: 'offerDraw', player: KNIGHT },
      { type: 'forfeit', player: KNIGHT, reason: 'exit' },
    ];
    for (const a of actions) expect(applyAction(done, a, scriptedRng([]))).toEqual({ ok: false, error: 'matchFinished' });
  });
});

describe('draw offers', () => {
  const offer = (s: MatchState, player: PlayerIndex = KNIGHT) => act(s, { type: 'offerDraw', player }).state;
  const respond = (s: MatchState, accept: boolean) => act(s, { type: 'respondDraw', player: MONK, accept }).state;

  it('ends in a draw when accepted', () => {
    const s = respond(offer(knightVsMonk()), true);
    expect(s).toMatchObject({ status: 'finished', result: { kind: 'draw' } });
  });

  it('only the attacker can offer, and only the other player can answer', () => {
    const s = knightVsMonk();
    expect(applyAction(s, { type: 'offerDraw', player: MONK }, scriptedRng([]))).toEqual({ ok: false, error: 'notYourTurn' });
    const offered = offer(s);
    expect(applyAction(offered, { type: 'respondDraw', player: KNIGHT, accept: true }, scriptedRng([]))).toEqual({ ok: false, error: 'noDrawOffer' });
    expect(applyAction(s, { type: 'respondDraw', player: MONK, accept: true }, scriptedRng([]))).toEqual({ ok: false, error: 'noDrawOffer' });
  });

  it('blocks attacking while an offer is open', () => {
    expect(applyAction(offer(knightVsMonk()), { type: 'attack', player: KNIGHT }, scriptedRng([]))).toEqual({ ok: false, error: 'drawOfferPending' });
  });

  it('after a reject, blocks offers for the next 3 attacking turns', () => {
    let s = respond(offer(knightVsMonk()), false);
    expect(s.players[KNIGHT].drawCooldown).toBe(DRAW_OFFER_COOLDOWN_TURNS);
    // not again in the same turn
    expect(applyAction(s, { type: 'offerDraw', player: KNIGHT }, scriptedRng([]))).toEqual({ ok: false, error: 'cannotOfferDraw' });

    const knightTurnsAllowed: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      s = act(s, { type: 'attack', player: KNIGHT }, [1, 1]).state; // 0 damage
      s = act(s, { type: 'attack', player: MONK }, [1, 1]).state;
      knightTurnsAllowed.push(s.canOfferDraw);
    }
    expect(knightTurnsAllowed).toEqual([false, false, false, true]);
    expect(() => offer(s)).not.toThrow();
  });
});

describe('energy', () => {
  it('gives 2 per 1% of own max HP lost and 1 per 1% dealt', () => {
    // Monk loses 4 of 61 HP = 6% (rounded down)
    const { state } = act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [7, 3]);
    expect(state.players[MONK].energy).toBe(12);
    expect(state.players[KNIGHT].energy).toBe(6);
  });

  it('counts counter damage too', () => {
    // Knight loses 5 of 60 HP = 8%
    const { state } = act(knightVsMonk(), { type: 'attack', player: KNIGHT }, [5, 10]);
    expect(state.players[KNIGHT].energy).toBe(16);
    expect(state.players[MONK].energy).toBe(8);
  });
});

describe('earning powerups', () => {
  // POWERUP_IDS order: berserk, luckyStrike, vampiricEdge, ironWall, fortress, thorns, secondWind
  it('offers 2 different powerups when the meter reaches 100, keeping leftover energy', () => {
    const s = tweak(knightVsMonk(), (s) => (s.players[KNIGHT].energy = 95));
    // rolls 7 vs 3, then offer: first index 0, second = (0 + 2) % 7
    const { state, events } = act(s, { type: 'attack', player: KNIGHT }, [7, 3, 0, 2]);
    expect(state.players[KNIGHT].offer).toEqual(['berserk', 'vampiricEdge']);
    expect(state.players[KNIGHT].energy).toBe(1);
    expect(events).toContainEqual({ type: 'powerupOffered', player: KNIGHT, options: ['berserk', 'vampiricEdge'] });
  });

  it('never offers the same powerup twice', () => {
    for (let first = 0; first < 7; first++) {
      for (let step = 1; step < 7; step++) {
        const s = tweak(knightVsMonk(), (s) => (s.players[KNIGHT].energy = 99));
        const offer = act(s, { type: 'attack', player: KNIGHT }, [7, 3, first, step]).state.players[KNIGHT].offer!;
        expect(offer[0]).not.toBe(offer[1]);
      }
    }
  });

  it('lets the player keep one of the two', () => {
    const s = tweak(knightVsMonk(), (s) => (s.players[KNIGHT].offer = ['berserk', 'thorns']));
    expect(applyAction(s, { type: 'pickPowerup', player: KNIGHT, powerup: 'fortress' }, scriptedRng([]))).toEqual({ ok: false, error: 'powerupNotOffered' });
    const { state } = act(s, { type: 'pickPowerup', player: KNIGHT, powerup: 'thorns' });
    expect(state.players[KNIGHT]).toMatchObject({ held: ['thorns'], offer: null });
    expect(applyAction(state, { type: 'pickPowerup', player: KNIGHT, powerup: 'thorns' }, scriptedRng([]))).toEqual({ ok: false, error: 'noPowerupOffer' });
  });

  it('picks at random if the player has not chosen by their next attacking turn', () => {
    const s = tweak(knightVsMonk(), (s) => {
      s.attacker = MONK;
      s.players[KNIGHT].offer = ['berserk', 'thorns'];
    });
    // Monk attacks for 0 damage, then the Knight's turn starts and the offer is resolved with index 1
    const { state, events } = act(s, { type: 'attack', player: MONK }, [1, 1, 1]);
    expect(state.players[KNIGHT]).toMatchObject({ held: ['thorns'], offer: null });
    expect(events).toContainEqual({ type: 'powerupPicked', player: KNIGHT, powerup: 'thorns', auto: true });
  });

  it(`holds at most ${MAX_HELD_POWERUPS}; the meter waits at 100 until a slot frees up`, () => {
    let s = tweak(knightVsMonk(), (s) => {
      s.players[KNIGHT].held = ['berserk', 'fortress'];
      s.players[KNIGHT].energy = 95;
    });
    s = act(s, { type: 'attack', player: KNIGHT }, [7, 3]).state;
    expect(s.players[KNIGHT]).toMatchObject({ energy: ENERGY_MAX, offer: null });
    s = act(s, { type: 'attack', player: MONK }, [1, 1]).state;
    // using a powerup frees a slot: offer first index 3, second = (3 + 1) % 7
    const { state } = act(s, { type: 'activatePowerup', player: KNIGHT, powerup: 'berserk' }, [3, 1]);
    expect(state.players[KNIGHT]).toMatchObject({ energy: 0, offer: ['ironWall', 'fortress'], held: ['fortress'] });
  });
});

describe('using powerups', () => {
  const holding = (player: PlayerIndex, held: PowerupId[], s = knightVsMonk()) => tweak(s, (s) => (s.players[player].held = held));
  const activate = (s: MatchState, player: PlayerIndex, powerup: PowerupId) => act(s, { type: 'activatePowerup', player, powerup }).state;

  it('only allows attack powerups when attacking and defense powerups when defending', () => {
    for (const [id, p] of Object.entries(POWERUPS) as [PowerupId, (typeof POWERUPS)[PowerupId]][]) {
      for (const player of [KNIGHT, MONK] as const) {
        const attacking = player === KNIGHT;
        const allowed = p.timing === 'either' || (p.timing === 'attack') === attacking;
        const r = applyAction(holding(player, [id]), { type: 'activatePowerup', player, powerup: id }, scriptedRng([]));
        expect(r.ok, `${id} by ${attacking ? 'attacker' : 'defender'}`).toBe(allowed);
        if (!r.ok) expect(r.error).toBe('wrongTimingForPowerup');
      }
    }
  });

  it('needs the powerup to be held and used once', () => {
    const s = holding(KNIGHT, ['berserk', 'berserk']);
    expect(applyAction(s, { type: 'activatePowerup', player: KNIGHT, powerup: 'luckyStrike' }, scriptedRng([]))).toEqual({ ok: false, error: 'powerupNotHeld' });
    const once = activate(s, KNIGHT, 'berserk');
    expect(once.players[KNIGHT]).toMatchObject({ held: ['berserk'], active: ['berserk'] });
    expect(applyAction(once, { type: 'activatePowerup', player: KNIGHT, powerup: 'berserk' }, scriptedRng([]))).toEqual({ ok: false, error: 'powerupAlreadyActive' });
  });

  it('applies the stacking rule: highest value wins, never added together', () => {
    // GAME_RULES.md example: Knight (attackScore 9) with Berserk (+5) and Lucky Strike
    const both: PowerupId[] = ['berserk', 'luckyStrike'];
    expect(attackValue(3, HEROES.knight, both)).toBe(9);
    expect(attackValue(6, HEROES.knight, both)).toBe(11);
    expect(attackValue(3, HEROES.knight, ['berserk'])).toBe(8);
    expect(attackValue(3, HEROES.knight, [])).toBe(3);
    expect(defenseValue(2, HEROES.monk, ['ironWall', 'fortress'])).toBe(11); // 2 + 6 = 8 vs 11
    expect(defenseValue(7, HEROES.monk, ['ironWall', 'fortress'])).toBe(13);
  });

  it('uses the stacking rule in a real round and clears active powerups afterwards', () => {
    let s = holding(KNIGHT, ['berserk', 'luckyStrike']);
    s = activate(activate(s, KNIGHT, 'berserk'), KNIGHT, 'luckyStrike');
    const { state } = act(s, { type: 'attack', player: KNIGHT }, [6, 1]);
    expect(lastRound(state)).toMatchObject({ attackRoll: 6, attackValue: 11, damageToDefender: 10, attackerPowerups: ['berserk', 'luckyStrike'] });
    expect(state.players[KNIGHT]).toMatchObject({ active: [], held: [] });
  });

  it('Vampiric Edge heals half the damage dealt, never above max', () => {
    const vamp = (hp: number, rolls: number[]) => {
      const s = activate(tweak(holding(KNIGHT, ['vampiricEdge']), (s) => (s.players[KNIGHT].hp = hp)), KNIGHT, 'vampiricEdge');
      return act(s, { type: 'attack', player: KNIGHT }, rolls).state;
    };
    expect(vamp(50, [9, 2]).players[KNIGHT].hp).toBe(53); // 7 damage, heal 3
    expect(vamp(59, [9, 2]).players[KNIGHT].hp).toBe(60); // capped at max
    expect(vamp(50, [1, 5]).players[KNIGHT].hp).toBe(46); // no damage dealt, no heal; 4 counter damage
  });

  it('Iron Wall and Fortress raise the defense value', () => {
    const s = activate(holding(MONK, ['fortress']), MONK, 'fortress');
    const { state } = act(s, { type: 'attack', player: KNIGHT }, [9, 2]);
    expect(lastRound(state)).toMatchObject({ defenseRoll: 2, defenseValue: 11, damageToAttacker: 2 });
  });

  it('Thorns doubles counter damage', () => {
    const s = activate(holding(MONK, ['thorns']), MONK, 'thorns');
    const { state } = act(s, { type: 'attack', player: KNIGHT }, [2, 8]);
    expect(state.players[KNIGHT].hp).toBe(48); // 6 counter damage doubled
  });

  it('Second Wind heals 20% of max HP before damage, for attacker or defender', () => {
    let s = activate(tweak(holding(KNIGHT, ['secondWind']), (s) => (s.players[KNIGHT].hp = 30)), KNIGHT, 'secondWind');
    let state = act(s, { type: 'attack', player: KNIGHT }, [1, 10]).state;
    expect(state.players[KNIGHT].hp).toBe(33); // 30 + 12 - 9
    expect(lastRound(state).healed).toEqual([12, 0]);

    s = activate(tweak(holding(MONK, ['secondWind']), (s) => (s.players[MONK].hp = 55)), MONK, 'secondWind');
    state = act(s, { type: 'attack', player: KNIGHT }, [9, 1]).state;
    expect(state.players[MONK].hp).toBe(53); // 55 + 6 (capped at 61) - 8
    expect(lastRound(state).healed).toEqual([0, 6]);
  });
});

describe('full random matches', () => {
  it('always end, and HP / energy / held powerups stay within limits', () => {
    const rng = seededRng(2026);
    for (let game = 0; game < 300; game++) {
      const heroA = HERO_IDS[game % 5]!;
      const heroB = HERO_IDS[Math.floor(game / 5) % 5]!;
      let s = createMatch([heroA, heroB], rng).state;
      for (let step = 0; s.status === 'active'; step++) {
        expect(step).toBeLessThan(1000);
        for (const p of [0, 1] as const) {
          const me = s.players[p];
          if (me.offer) s = expectOk(applyAction(s, { type: 'pickPowerup', player: p, powerup: me.offer[0] }, rng));
          for (const id of [...s.players[p].held]) {
            const r = applyAction(s, { type: 'activatePowerup', player: p, powerup: id }, rng);
            if (r.ok) s = r.state;
          }
        }
        s = expectOk(applyAction(s, { type: 'attack', player: s.attacker }, rng));
        for (const me of s.players) {
          const hero = HEROES[me.heroId];
          expect(me.hp).toBeGreaterThanOrEqual(0);
          expect(me.hp).toBeLessThanOrEqual(hero.maxHp);
          expect(me.energy).toBeGreaterThanOrEqual(0);
          expect(me.energy).toBeLessThanOrEqual(ENERGY_MAX);
          expect(me.held.length).toBeLessThanOrEqual(MAX_HELD_POWERUPS);
        }
      }
      expect(s.result?.kind).toBe('knockout');
    }
  });
});

function expectOk(r: ReturnType<typeof applyAction>): MatchState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
