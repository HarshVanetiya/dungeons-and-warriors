# Dungeon Drill

A 1v1 online dice-duel. Pick one of five balanced heroes, out-roll your opponent's guard, and climb the Elo leaderboard.

> **How this was built:** written with [Claude Code](https://claude.com/claude-code), Anthropic's AI coding agent, working from my requirements.

| Doc | What's in it |
|---|---|
| [`GAME_RULES.md`](GAME_RULES.md) | Every rule of the game. The single source of truth. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Step-by-step free deployment: Vercel, Render, Neon and Resend |
| [`apps/server/README.md`](apps/server/README.md) | Server setup, HTTP API and Socket.IO protocol |

## Repo layout

| Path | What it is |
|---|---|
| `packages/game` | The rules engine: heroes, dice, damage, powerups, Elo. Pure TypeScript with unit tests. |
| `apps/server` | Express + Socket.IO + Prisma/Postgres: accounts, matchmaking, live matches |
| `apps/web` | Next.js app: sign-up and login, lobby, match screen, fight scene, leaderboard |
| `tools/balance.mjs` | Balance check for hero stats (`npm run balance`) |

## Run it locally

You need Node 22+ and a Postgres database.

```bash
npm install
cp apps/server/.env.example apps/server/.env    # set DATABASE_URL and the two secrets
cp apps/web/.env.example apps/web/.env.local
npm run db:migrate -w @dungeon-drill/server     # create the tables

npm run dev:server   # terminal 1: http://localhost:4000
npm run dev:web      # terminal 2: http://localhost:3000
```

Sign-up codes are printed in the server terminal (`EMAIL_MODE=log`). To play against yourself, open a second browser (or a private window) and sign up a second account.

## Checks

```bash
npm run typecheck
npm test                 # server tests need TEST_DATABASE_URL (see apps/server/README.md)
npm run balance          # after changing hero stats or powerups
```
