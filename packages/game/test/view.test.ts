import { describe, expect, it } from 'vitest';
import { eventFor, viewFor, type MatchEvent } from '../src/index.js';
import { act, newMatch, tweak } from './helpers.js';

describe('viewFor', () => {
  const s = tweak(newMatch(['knight', 'monk']), (s) => {
    s.players[0].held = ['berserk', 'thorns'];
    s.players[1].held = ['fortress'];
    s.players[1].offer = ['secondWind', 'ironWall'];
  });

  it('shows your own powerups in full', () => {
    const v = viewFor(s, 1);
    expect(v.me).toMatchObject({ held: ['fortress'], offer: ['secondWind', 'ironWall'] });
  });

  it("shows only the count of the opponent's powerups", () => {
    const v = viewFor(s, 1);
    expect(v.opponent).toEqual({ heroId: 'knight', hp: 60, energy: 0, heldCount: 2 });
    expect(JSON.stringify(v.opponent)).not.toMatch(/berserk|thorns/);
  });

  it('keeps activated powerups in the count until the roll, so activation stays secret', () => {
    const activated = act(s, { type: 'activatePowerup', player: 0, powerup: 'berserk' }).state;
    expect(viewFor(activated, 1).opponent.heldCount).toBe(2);
    expect(JSON.stringify(viewFor(activated, 1))).not.toMatch(/berserk/);
  });

  it('only lets the attacker see canOfferDraw', () => {
    expect(viewFor(s, 0).canOfferDraw).toBe(true);
    expect(viewFor(s, 1).canOfferDraw).toBe(false);
  });
});

describe('eventFor', () => {
  it('hides offers and activations from the opponent', () => {
    const offered: MatchEvent = { type: 'powerupOffered', player: 0, options: ['berserk', 'thorns'] };
    const activated: MatchEvent = { type: 'powerupActivated', player: 0, powerup: 'berserk' };
    expect(eventFor(offered, 0)).toBe(offered);
    expect(eventFor(offered, 1)).toBeNull();
    expect(eventFor(activated, 1)).toBeNull();
  });

  it('tells the opponent a powerup was picked, but not which one', () => {
    const picked: MatchEvent = { type: 'powerupPicked', player: 0, powerup: 'thorns', auto: false };
    expect(eventFor(picked, 0)).toBe(picked);
    expect(eventFor(picked, 1)).toEqual({ type: 'opponentPickedPowerup', player: 0 });
  });
});
