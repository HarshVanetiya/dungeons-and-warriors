# Dungeon Drill: Game Rules

The single source of truth for how the game works. Update this file whenever a rule is decided or changed.

## 1. Overview

Dungeon Drill is an online multiplayer 1v1 dice-duel game. Two players each pick one of 5 heroes and fight until one hero's HP reaches 0.

## 2. Heroes

Each hero has three stats:

| Stat | Meaning |
|---|---|
| `maxHp` | Starting and maximum health |
| `attackScore` | The highest value this hero can roll when attacking |
| `defenseScore` | The highest value this hero can roll when defending |

| Hero | `attackScore` | `defenseScore` | `maxHp` | Style |
|---|---|---|---|---|
| Berserker | 14 | 6 | 45 | Huge hits, weak guard, lowest HP. Wins fast or dies fast. |
| Rogue | 11 | 8 | 51 | Attack-leaning, a bit sturdier than the Berserker. |
| Knight | 9 | 9 | 60 | Even at everything. The baseline hero. |
| Monk | 7 | 11 | 61 | Counter-puncher. Best guard, so attackers often hurt themselves (see section 4). |
| Guardian | 7 | 9 | 85 | Tank. Weak dice, but by far the most HP. |

**Why it's fair.** Because a high defense roll hurts the attacker (section 4), attack and defense are worth about the same. So the rule of thumb is: the lower a hero's `attackScore + defenseScore`, the more HP it gets.

Every matchup has been checked with `node tools/balance.mjs`. That script calculates the exact win chance under the base rules and also simulates matches with powerups:

| Matchup | Base rules | With powerups |
|---|---|---|
| Berserker vs Rogue | 49.9% | 49.7% |
| Berserker vs Knight | 49.3% | 49.0% |
| Berserker vs Monk | 50.6% | 50.4% |
| Berserker vs Guardian | 49.3% | 49.3% |
| Rogue vs Knight | 49.8% | 48.6% |
| Rogue vs Monk | 48.5% | 48.1% |
| Rogue vs Guardian | 50.8% | 50.2% |
| Knight vs Monk | 48.3% | 48.8% |
| Knight vs Guardian | 50.5% | 50.9% |
| Monk vs Guardian | 49.0% | 49.3% |

The percentage is the chance the first-named hero wins. Every matchup is within 2% of 50/50. Stat changes must keep every matchup within 3% (the script fails otherwise).

## 3. Match and turns

- A match has 2 players. Each picks one hero before joining the queue. Both players may pick the same hero.
- The server flips a coin to decide who attacks first.
- The game is turn-based. Each round, one player **attacks** and the other **defends**.
- Roles swap every round: if Player A attacked in round 1, Player B attacks in round 2.
- The attacker has **30 seconds** to press **Attack**. Before the roll, both players may activate powerups (section 7).
- Rounds continue until one hero's HP reaches 0.

## 4. Rolling and damage

- The attacker rolls an **attack value**: a random whole number from 1 to their hero's `attackScore`. Every value is equally likely.
- The defender rolls a **defense value**: a random whole number from 1 to their hero's `defenseScore`.
- `diff = attackRoll - defenseRoll`
  - `diff > 0`: the **defender** loses `diff` HP.
  - `diff < 0`: the defender blocked and countered, so the **attacker** loses `-diff` HP (counter damage).
  - `diff = 0`: nothing happens.
- HP never goes below 0.
- **All dice are rolled on the server, never on the client.** The client only says "I'm taking my turn".

**Examples.** A Knight (`attackScore` 9) attacks a Monk (`defenseScore` 11).
- The Knight rolls 7 and the Monk rolls 3: diff = 4, so the Monk loses 4 HP.
- The Knight rolls 5 and the Monk rolls 10: diff = -5, so the **Knight** loses 5 HP.
- Both roll 6: diff = 0, so nobody is hurt.

## 5. End of match

| Result | What happens |
|---|---|
| Knockout | A hero reaches 0 HP, either from an attack or from counter damage. The other player wins. |
| Exit | A player presses **Exit** and confirms. They lose and the other player wins. |
| No response | The attacker doesn't press Attack within 30 seconds. They lose. |
| Disconnect | A player who disconnects has 30 seconds to reconnect. If they don't, they lose. |
| Draw | Both players agree to a draw (below). Nobody wins and nobody's Elo changes. |

**Draw offers**
- The attacker can offer a draw at the start of their turn, before pressing Attack. Their 30-second turn timer pauses while the offer is open.
- The other player sees **Accept** / **Reject** and has 30 seconds to answer. Not answering counts as **Reject**, not as a loss.
- Accept: the match ends in a draw.
- Reject: play continues, and the player who offered can't offer again for their next 3 attacking turns, so offers can't be spammed.

## 6. Elo rating

- Every player has one global rating, like chess.com. It starts at **1200**.
- The rating change depends on the opponent's rating, for wins and for losses. Beating a stronger player gains more, and losing to a weaker player costs more.
- Standard Elo with K = 32. For each match the server computes one number, `delta`, from the winner's point of view:

```
expected(winner) = 1 / (1 + 10^((eloLoser - eloWinner) / 400))
delta  = round(32 * (1 - expected(winner)))
winner: newElo = elo + delta
loser:  newElo = elo - delta
draw:   newElo = elo   (no change for either player)
```

- `delta` is rounded once and applied to both players, so the winner gains exactly what the loser loses.
- Exits, timeouts and disconnects count as normal losses.

**Matchmaking limit.** Two players are only matched if **each** of them would gain at least **6** for a win. In practice the ratings must be within **273** points of each other:

| Rating gap | Stronger player wins | Weaker player wins |
|---|---|---|
| 0 | +16 | +16 |
| 100 | +12 | +20 |
| 200 | +8 | +24 |
| 273 (max) | +6 | +26 |

- A global **leaderboard** ranks all players by Elo.

## 7. Powerups

Powerups are **personal**, not shared. The system is inspired by Shadow Fight's energy meter: fighting fills the meter, and a full meter earns a powerup.

**Energy meter**
- Each player has their own energy meter, from 0 to **100**. Both players can see both meters.
- **Taking damage:** +2 energy for every full 1% of your own `maxHp` you lose.
- **Dealing damage:** +1 energy for every full 1% of the opponent's `maxHp` they lose. Counter damage counts too.
- Taking damage fills the meter faster than dealing it, so the player who is behind gets powerups sooner (a comeback mechanic).
- Using percentages instead of raw HP keeps it fair between high-HP and low-HP heroes.

**Earning a powerup**
- When the meter reaches 100, it drops by 100 (leftover energy carries over), and the player is offered **2 different random powerups** and keeps **1**.
- If they haven't picked one by the start of their next attacking turn, the server picks one of the two at random.
- A player can hold at most **2** powerups. While both slots are full, the meter stays at 100. The next offer appears as soon as a slot frees up.
- The opponent can see **how many** powerups you hold, but not **which** ones.

**Using powerups**
- Powerups can be used on your attacking turn **and** on your defending turn, any time before the attacker presses Attack.
- Each powerup is used once, then it's gone.
- Your opponent doesn't see what you activated until the roll is shown.
- More than one powerup can be used on the same roll.

| Powerup | Use when | Effect |
|---|---|---|
| Berserk | Attacking | This attack value = roll + half your `attackScore` (rounded up) |
| Lucky Strike | Attacking | This attack value = your full `attackScore` |
| Vampiric Edge | Attacking | If this attack deals damage, heal 50% of it (rounded down, never above max) |
| Iron Wall | Defending | This defense value = roll + half your `defenseScore` (rounded up) |
| Fortress | Defending | This defense value = your full `defenseScore` |
| Thorns | Defending | If you block this attack, the attacker takes double counter damage |
| Second Wind | Either | Heal 20% of your `maxHp` (rounded down, never above max) |

Berserk and Iron Wall scale with the hero's own score, not a flat +5. A flat bonus would be worth far more to a 7-attack Guardian than to a 14-attack Berserker and would break the balance.

**Stacking rule.** Roll changes never add on top of each other. Each one gives its own value, and the **highest** value counts.

```
attackValue  = max(roll, roll + ceil(attackScore / 2) if Berserk, attackScore if Lucky Strike)
defenseValue = max(roll, roll + ceil(defenseScore / 2) if Iron Wall, defenseScore if Fortress)
```

Example: a Knight (`attackScore` 9) uses Berserk (+5) and Lucky Strike together.
- Roll 3: Berserk gives 8, Lucky Strike gives 9, so the attack value is **9**.
- Roll 6: Berserk gives 11, Lucky Strike gives 9, so the attack value is **11**.

Vampiric Edge, Thorns and Second Wind don't change the roll, so they always work alongside the others.

## 8. Tech

Monorepo using npm workspaces, everything in TypeScript:

| Part | Choice | Notes |
|---|---|---|
| `packages/game` | Plain TypeScript, no framework | The rules engine: heroes, rolls, damage, energy, powerups, Elo. Pure functions with unit tests. Only the server runs it for real. The web app uses it for types and display constants. |
| `apps/server` | Express + TypeScript + Socket.IO | Authoritative game server: matchmaking queue, turn timers, rolling, results. REST for profile and leaderboard, Socket.IO for live matches. |
| `apps/web` | Next.js (App Router) + TypeScript | Lobby, hero select, match screen, leaderboard. |
| Database | PostgreSQL + Prisma | Players, ratings, match history (including every round's rolls). |
| Animation | Framer Motion for UI, PixiJS for the fight scene | When a match ends, the server sends the full round log and the client plays a short fight cinematic of the final rounds, ending in the KO. |
| Balance check | `tools/balance.mjs` | Run it after every change to hero stats or powerups. |

## 9. Undecided

Open questions. Move each one into the right section above once it's decided.

- Login method (accounts are needed for Elo and the leaderboard).
- Hosting and deployment.
- Art style and hero sprites.
