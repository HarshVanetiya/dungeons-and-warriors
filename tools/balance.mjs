// Balance check for the heroes in GAME_RULES.md section 2.
// Run: node tools/balance.mjs [gamesPerMatchup]
// 1) exact win chance for every matchup using base rules only (no powerups)
// 2) Monte Carlo with energy and powerups, using a simple bot policy
// Keep HEROES and the rules below in sync with GAME_RULES.md.

const HEROES = [
  { name: 'Berserker', atk: 14, def: 6, hp: 45 },
  { name: 'Rogue', atk: 11, def: 8, hp: 51 },
  { name: 'Knight', atk: 9, def: 9, hp: 60 },
  { name: 'Monk', atk: 7, def: 11, hp: 61 },
  { name: 'Guardian', atk: 7, def: 9, hp: 85 },
];
const TARGET = 0.03; // every matchup must be within 47%..53%

// ---------- exact (base rules) ----------

function diffDist(atk, def) {
  const m = new Map();
  for (let a = 1; a <= atk; a++) for (let d = 1; d <= def; d++) m.set(a - d, (m.get(a - d) || 0) + 1 / (atk * def));
  return m;
}

// Chance that X beats Y, first attacker decided by coin flip.
// diff > 0 hurts the defender, diff < 0 hurts the attacker (counter damage).
function exactWinChance(X, Y) {
  const dist = [diffDist(X.atk, Y.def), diffDist(Y.atk, X.def)];
  const memo = new Map();
  // [chance X wins if X attacks next, chance X wins if Y attacks next]
  function P(hx, hy) {
    if (hx <= 0) return [0, 0];
    if (hy <= 0) return [1, 1];
    const key = hx * 10000 + hy;
    if (memo.has(key)) return memo.get(key);
    const S = [0, 0], tie = [0, 0];
    for (const a of [0, 1]) for (const [diff, p] of dist[a]) {
      if (diff === 0) { tie[a] += p; continue; }
      let nx = hx, ny = hy;
      const hurtsY = (a === 0) === (diff > 0);
      if (hurtsY) ny -= Math.abs(diff); else nx -= Math.abs(diff);
      S[a] += p * P(nx, ny)[1 - a];
    }
    // a 0-damage round only swaps roles, so solve the two states together
    const p0 = (S[0] + tie[0] * S[1]) / (1 - tie[0] * tie[1]);
    const res = [p0, S[1] + tie[1] * p0];
    memo.set(key, res);
    return res;
  }
  const [a, b] = P(X.hp, Y.hp);
  return (a + b) / 2;
}

// ---------- Monte Carlo (energy + powerups) ----------

const roll = n => 1 + Math.floor(Math.random() * n);
const POWERUPS = ['berserk', 'luckyStrike', 'vampiricEdge', 'ironWall', 'fortress', 'thorns', 'secondWind'];
const ENERGY_MAX = 100, HOLD_MAX = 2;

function simulate(X, Y) {
  const H = [X, Y];
  const P = H.map(h => ({ hp: h.hp, energy: 0, held: [] }));
  const use = (p, name) => { const i = p.held.indexOf(name); if (i < 0) return false; p.held.splice(i, 1); return true; };
  const addEnergy = (i, amount) => {
    const p = P[i];
    p.energy += amount;
    while (p.energy >= ENERGY_MAX && p.held.length < HOLD_MAX) {
      p.energy -= ENERGY_MAX;
      // offer 2 different powerups, bot keeps one at random
      const first = roll(POWERUPS.length) - 1;
      const second = (first + roll(POWERUPS.length - 1)) % POWERUPS.length;
      p.held.push(POWERUPS[roll(2) === 1 ? first : second]);
    }
    if (p.held.length >= HOLD_MAX) p.energy = Math.min(p.energy, ENERGY_MAX);
  };
  const hit = (victim, dmg) => {
    P[victim].hp = Math.max(0, P[victim].hp - dmg);
    addEnergy(victim, 2 * Math.floor((100 * dmg) / H[victim].hp));
    addEnergy(1 - victim, Math.floor((100 * dmg) / H[victim].hp));
  };

  let att = roll(2) - 1;
  while (P[0].hp > 0 && P[1].hp > 0) {
    const def = 1 - att, A = P[att], D = P[def];
    for (const i of [att, def]) {
      if (P[i].hp < H[i].hp / 2 && use(P[i], 'secondWind')) P[i].hp = Math.min(H[i].hp, P[i].hp + Math.floor(H[i].hp / 5));
    }
    const ar = roll(H[att].atk), dr = roll(H[def].def);
    const atkOptions = [ar], defOptions = [dr];
    if (use(A, 'berserk')) atkOptions.push(ar + Math.ceil(H[att].atk / 2));
    if (use(A, 'luckyStrike')) atkOptions.push(H[att].atk);
    if (use(D, 'ironWall')) defOptions.push(dr + Math.ceil(H[def].def / 2));
    if (use(D, 'fortress')) defOptions.push(H[def].def);
    const vampiric = use(A, 'vampiricEdge'), thorns = use(D, 'thorns');
    const diff = Math.max(...atkOptions) - Math.max(...defOptions);
    if (diff > 0) {
      hit(def, diff);
      if (vampiric) A.hp = Math.min(H[att].hp, A.hp + Math.floor(diff / 2));
    } else if (diff < 0) {
      hit(att, thorns ? -2 * diff : -diff);
    }
    att = def;
  }
  return P[0].hp > 0;
}

// ---------- report ----------

const N = Number(process.argv[2]) || 50000;
let worst = 0;
console.log('matchup'.padEnd(22), 'base(exact)', ' with powerups');
for (let i = 0; i < HEROES.length; i++) for (let j = i + 1; j < HEROES.length; j++) {
  const X = HEROES[i], Y = HEROES[j];
  const base = exactWinChance(X, Y);
  let wins = 0;
  for (let k = 0; k < N; k++) if (simulate(X, Y)) wins++;
  const pu = wins / N;
  worst = Math.max(worst, Math.abs(base - 0.5), Math.abs(pu - 0.5));
  console.log(`${X.name} vs ${Y.name}`.padEnd(22), `${(100 * base).toFixed(1)}%`.padStart(11), `${(100 * pu).toFixed(1)}%`.padStart(14));
}
console.log(`\nworst matchup is ${(100 * worst).toFixed(1)}% away from 50/50 (limit ${100 * TARGET}%)`);
process.exitCode = worst <= TARGET ? 0 : 1;
