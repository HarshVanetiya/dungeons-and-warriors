// Balance check for the heroes in GAME_RULES.md section 2.
// Run from the repo root: npm run balance [-- gamesPerMatchup]
// 1) exact win chance for every matchup using base rules only (no powerups)
// 2) full matches played through the real engine (energy + powerups) with a simple bot

import {
  HEROES,
  HERO_IDS,
  POWERUPS,
  applyAction,
  createMatch,
  exactWinChance,
  seededRng,
} from '../packages/game/dist/index.js';

const TARGET = 0.03; // every matchup must be within 47%..53%
const N = Number(process.argv[2]) || 20000;
const rng = seededRng(12345);

function step(state, action) {
  const r = applyAction(state, action, rng);
  return r.ok ? r.state : state;
}

// Bot: keeps a random offered powerup, uses attack/defense powerups as soon as they fit,
// and Second Wind once below half HP.
function playMatch(heroA, heroB) {
  let s = createMatch([heroA, heroB], rng).state;
  while (s.status === 'active') {
    for (const p of [0, 1]) {
      const me = s.players[p];
      if (me.offer) s = step(s, { type: 'pickPowerup', player: p, powerup: me.offer[rng.int(0, 1)] });
      const attacking = p === s.attacker;
      for (const id of [...s.players[p].held]) {
        const { timing } = POWERUPS[id];
        const fits =
          timing === 'either'
            ? s.players[p].hp < HEROES[s.players[p].heroId].maxHp / 2
            : (timing === 'attack') === attacking;
        if (fits) s = step(s, { type: 'activatePowerup', player: p, powerup: id });
      }
    }
    s = step(s, { type: 'attack', player: s.attacker });
  }
  return s.result.winner === 0;
}

let worst = 0;
console.log('matchup'.padEnd(22), 'base(exact)', ' with powerups');
for (let i = 0; i < HERO_IDS.length; i++) {
  for (let j = i + 1; j < HERO_IDS.length; j++) {
    const a = HERO_IDS[i];
    const b = HERO_IDS[j];
    const base = exactWinChance(HEROES[a], HEROES[b]);
    let wins = 0;
    for (let k = 0; k < N; k++) if (playMatch(a, b)) wins++;
    const withPowerups = wins / N;
    worst = Math.max(worst, Math.abs(base - 0.5), Math.abs(withPowerups - 0.5));
    console.log(
      `${HEROES[a].name} vs ${HEROES[b].name}`.padEnd(22),
      `${(100 * base).toFixed(1)}%`.padStart(11),
      `${(100 * withPowerups).toFixed(1)}%`.padStart(14),
    );
  }
}
console.log(`\nworst matchup is ${(100 * worst).toFixed(1)}% away from 50/50 (limit ${100 * TARGET}%)`);
process.exitCode = worst <= TARGET ? 0 : 1;
