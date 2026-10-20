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

Every matchup has been checked with `npm run balance`. It calculates the exact win chance under the base rules, then plays 20,000 matches per matchup through the real game engine (`packages/game`), with powerups used by a simple bot:

| Matchup | Base rules | With powerups |
|---|---|---|
| Berserker vs Rogue | 49.9% | 50.1% |
| Berserker vs Knight | 49.3% | 48.5% |
| Berserker vs Monk | 50.6% | 50.6% |
| Berserker vs Guardian | 49.3% | 49.9% |
| Rogue vs Knight | 49.8% | 49.4% |
| Rogue vs Monk | 48.5% | 47.7% |
| Rogue vs Guardian | 50.8% | 50.4% |
| Knight vs Monk | 48.3% | 48.3% |
| Knight vs Guardian | 50.5% | 50.8% |
| Monk vs Guardian | 49.0% | 49.3% |

The percentage is the chance the first-named hero wins. Every matchup is within 2.5% of 50/50. Stat changes must keep every matchup within 3%; the script and the unit tests fail otherwise.

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
- The offer stays open until they pick. If it's still open when they press Attack, the server picks one of the two at random first. It goes into their slots and can't be used on that roll. So there's always at least a full turn to choose, even when the meter fills while defending.
- A player can hold at most **2** powerups. While both slots are full, the meter stays at 100. The next offer appears as soon as a slot frees up.
- The opponent can see **how many** powerups you hold, but not **which** ones.

**Using powerups**
- Powerups can be used on your attacking turn **and** on your defending turn, any time before the attacker presses Attack.
- Each powerup is used once, then it's gone.
- Your opponent doesn't see what you activated until the roll is shown.
- More than one powerup can be used on the same roll, but not two copies of the same powerup.
- Activating is final: an activated powerup can't be taken back.
- To keep activations secret, the opponent's powerup count doesn't drop until the roll is shown.
- Every effect, Second Wind's heal included, happens when the attacker presses Attack. Heals come first, then damage, then Vampiric Edge's heal.

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

## 8. Accounts

**Sign-up**
- The player enters **email**, **username** and **password**. Password: at least 8 characters.
- The username is shown on the leaderboard and in matches. Emails are never shown to other players. Usernames are unique, 3–16 characters, letters, numbers and `_`.
- The server emails a **6-digit code**. The account can't play until the player enters that code (email verified).
- Passwords are never stored as plain text. Only an **argon2id hash** is saved, so even if the database leaks, nobody can read passwords.

**Login**
- Email + password. Only verified accounts can log in to play. An unverified account is sent back to the "enter code" screen.
- After 5 wrong passwords, that account can't log in for 15 minutes.
- The login session is kept in a secure, httpOnly cookie (JWT), valid for 30 days. The web app reaches the API through its own `/api` path (a Next.js rewrite to the server), so the cookie belongs to the web app's domain. Without that, browsers would block it as a third-party cookie, because Vercel and Render are different domains.
- Live matches use Socket.IO straight to the server, since Vercel can't pass WebSockets through. To join, the web app first gets a short-lived (60-second) match token from `/api/socket-token` and sends it when connecting.

**Forgot password**
1. The player enters their email. The screen always says "If an account exists, we sent a code", so nobody can use it to check who has an account.
2. The server emails a 6-digit code.
3. The player enters the code and a new password. Every other logged-in device is logged out.

**Codes (for both email verification and forgot password)**
- Valid for **10 minutes** and usable once.
- Wrong code 5 times: the code is cancelled and the player must request a new one.
- "Resend code" works at most once every 60 seconds.
- Only a hash of the code is stored, like passwords.

## 9. Art style

Inspired by **Shadow Fight 3** and **God of War**: dark fantasy, heavy and cinematic. This sets the mood only. No art, characters or assets are copied from those games.

- **Look:** dark, moody dungeon arenas with fog and torchlight. Heroes are detailed 2D fighters with strong silhouettes. Colours are muted, except glowing effects.
- **Energy and powerups:** the energy meter and powerups glow with purple-black "shadow energy" smoke, like Shadow Fight 3's shadow form. Each powerup has its own glow colour (red Berserk, gold Lucky Strike, blue Iron Wall, and so on).
- **Hits:** God of War-style weight: a short hit-stop freeze on each hit, camera shake scaled to the damage, sparks on blocks, and a different flash for counter damage.
- **End-of-match fight scene:** the final rounds play back as a short cinematic. The KO blow is in slow motion with a zoom on the winner, then the result and Elo change appear.
- **Made with:** AI-generated images (heroes, arenas, powerup icons), touched up so all 5 heroes share one consistent style.
- **Hero look:** Berserker (fur, twin axes), Rogue (hood, daggers), Knight (plate armour, sword and shield), Monk (wraps, bare hands, calm stance), Guardian (huge armour, tower shield and hammer).

## 10. Tech

Monorepo using npm workspaces, everything in TypeScript:

| Part | Choice | Notes |
|---|---|---|
| `packages/game` | Plain TypeScript, no framework | The rules engine: heroes, rolls, damage, energy, powerups, Elo. Pure functions with unit tests. Only the server runs it for real. The web app uses it for types and display constants. |
| `apps/server` | Express + TypeScript + Socket.IO | Authoritative game server: matchmaking queue, turn timers, rolling, results. REST for profile and leaderboard, Socket.IO for live matches. |
| `apps/web` | Next.js (App Router) + TypeScript | Lobby, hero select, match screen, leaderboard. |
| Database | PostgreSQL + Prisma | Players, ratings, match history (including every round's rolls), login codes. |
| Auth | Our own code in `apps/server` | argon2id password hashes, JWT session cookie, 6-digit email codes (section 8). |
| Email | Resend (`resend` npm package) | Sends the 6-digit codes. Kept behind one small `sendEmail()` function so the provider can be swapped later. |
| Animation | Framer Motion for UI, PixiJS for the fight scene | When a match ends, the server sends the full round log and the client plays a short fight cinematic of the final rounds, ending in the KO. |
| Balance check | `npm run balance` (`tools/balance.mjs`) | Run it after every change to hero stats or powerups. |

**Hosting (free for now)**

| Part | Where | Free plan limits to know |
|---|---|---|
| `apps/web` (Next.js) | Vercel, Hobby plan | Free, no sleeping. The Hobby plan is for non-commercial use, so move to Pro before earning money from the game. |
| `apps/server` (Express + Socket.IO) | Render, free web service | Sleeps after 15 minutes with no requests; waking takes about a minute, so the web app shows "Waking up the server…". A restart or sleep ends any live matches. That's fine while testing; fix it before a real launch. |
| Database | Neon, free Postgres | 0.5 GB of storage, plenty for now. Not Render's own Postgres: its free database is deleted after 30 days. |
| Email | Resend, free plan | About 100 emails/day. **Until a custom domain is verified, Resend only delivers to your own Resend account email.** Testers' codes therefore appear in the server log instead (`EMAIL_MODE=log`, see `DEPLOYMENT.md`). |

- **No MongoDB:** players, matches, ratings and the leaderboard are related tables, which Postgres handles better.
- **No Redis for now:** one server can keep the matchmaking queue and turn timers in memory. Redis (Upstash has a free plan) is only needed once there's more than one server.
- **Moving later:** Azure and GCP both offer managed Postgres. Moving the database means copying the data and changing `DATABASE_URL`; no code changes.

## 11. Undecided

Open questions. Move each one into the right section above once it's decided.

- Which AI image tool to use for the art, and checking that its licence allows use in a game.
- Which custom domain to buy. That comes after testing on the free URLs; the steps are in `DEPLOYMENT.md`.
