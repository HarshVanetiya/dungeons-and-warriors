# Dungeon Drill: Game Rules

The single source of truth for how the game works. Update this file whenever a rule is decided or changed.

## 1. Overview

Dungeon Drill is an online multiplayer 1v1 dice-duel game. Two players each pick one of 5 heroes and fight until one hero's HP reaches 0.

## 2. Heroes

There are 5 heroes. Each hero has three stats:

| Stat | Meaning |
|---|---|
| `maxHp` | Starting and maximum health |
| `attackScore` | The highest value this hero can roll when attacking |
| `defenseScore` | The highest value this hero can roll when defending |

Hero names and stats are not designed yet (see [Undecided](#9-undecided)).

## 3. Match and turns

- A match has 2 players. Each picks one hero.
- The game is turn-based. Each round, one player **attacks** and the other **defends**.
- Roles swap every round: if Player A attacked in round 1, Player B attacks in round 2.
- Rounds continue until one hero's HP reaches 0.

## 4. Rolling and damage

- The attacker rolls an **attack value**: a random whole number from 1 to their hero's `attackScore`. Every value is equally likely.
- The defender rolls a **defense value**: a random whole number from 1 to their hero's `defenseScore`.
- `damage = max(attackRoll - defenseRoll, 0)`. Damage is subtracted from the defender's HP.
- Damage is never negative. HP, attack and defense can never go below 0.
- **All dice are rolled on the server, never on the client.** The client only says "I'm taking my turn".

**Example.** A Knight (`attackScore` 10) attacks an Orc (`defenseScore` 4, HP 30).
The Knight rolls 7, the Orc rolls 3. Damage = 7 - 3 = 4. The Orc's HP goes from 30 to 26.
If the Knight had rolled 2 and the Orc 3, damage would be max(2 - 3, 0) = 0.

## 5. End of match

| Result | What happens |
|---|---|
| Knockout | A hero reaches 0 HP. The other player wins. |
| Timeout or disconnect | The player who timed out or disconnected loses. |
| Tie | Neither player's Elo changes. What causes a tie is undecided. |

## 6. Elo rating

- Every player has one global rating, like chess.com. It starts at **1200**.
- Win: rating goes up. Loss: rating goes down. **Tie: no change for either player** (this is different from normal Elo).
- Standard Elo formula with K = 32:

```
expected(A) = 1 / (1 + 10^((eloB - eloA) / 400))
win:  newElo = elo + 32 * (1 - expected)
loss: newElo = elo + 32 * (0 - expected)
tie:  newElo = elo
```

- Round results to whole numbers.
- Beating a higher-rated player gains more points than beating a lower-rated one.
- A global **leaderboard** ranks all players by Elo.

## 7. Powerups

**When they appear**
- Each player counts how many times **they** have attacked. On their own 3rd, 6th, 9th... attacking turn, a **checkpoint** happens.
- At a checkpoint there is a **30% chance** a powerup appears.
- If it appears: if that player holds **no** unused powerups, **1** powerup appears. If they are **still holding** unused ones, **2** appear.

**Claiming and holding**
- Powerups go into a **shared pool**. Either player can claim one. Whoever claims first gets it.
- There is no limit on how many a player can hold.
- Each powerup can be used once.

**Draft list** (starting ideas, can change)

| Powerup | Effect |
|---|---|
| Second Wind | Heal 20% of max HP (rounded down, never above max) |
| Berserk | Next attack roll +5 |
| Iron Wall | Next defense roll +5 |
| Lucky Strike | Next attack roll is forced to the hero's full `attackScore` |
| Vampiric Edge | Next successful attack heals the attacker for 50% of the damage dealt (rounded down, never above max) |

## 8. Tech

- Backend: **Express + TypeScript** (Node.js).
- Nothing else is decided yet. Add each decision here when it's made.

## 9. Undecided

Open questions. Move each one into the right section above once it's decided.

- Hero names and stats (`maxHp`, `attackScore`, `defenseScore`) for all 5 heroes.
- What causes a tie.
- Final powerup list (the list in section 7 is a draft).
- Everything in the tech stack beyond the backend.
