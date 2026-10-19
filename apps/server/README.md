# @dungeon-drill/server

Express + Socket.IO game server. It owns accounts, matchmaking, timers, dice and Elo. All game rules come from `@dungeon-drill/game`.

## Run it locally

You need Node 22+ and a Postgres database (a local install, Docker, or a free Neon project).

```bash
# from the repo root
npm install
cp apps/server/.env.example apps/server/.env      # then set DATABASE_URL and the two secrets
npm run db:migrate -w @dungeon-drill/server       # create the tables
npm run dev:server                                # http://localhost:4000, restarts on save
```

With `EMAIL_MODE=log`, sign-up and reset codes are printed in the terminal instead of emailed.

## Tests

The tests use a real, throwaway Postgres database. Everything in it is deleted on every run, so never point this at real data:

```bash
createdb dungeon_test
TEST_DATABASE_URL=postgresql://postgres@localhost:5432/dungeon_test npm test -w @dungeon-drill/server
```

Without `TEST_DATABASE_URL`, the database tests are skipped with a warning.

## Layout

| Path | What it does |
|---|---|
| `src/index.ts` | Entry point: reads env, connects to the DB, listens, shuts down cleanly on SIGTERM |
| `src/app.ts` | Builds the Express app, Socket.IO server and match manager (tests use this directly) |
| `src/config.ts` | Environment variables (validated with zod) and game timers |
| `src/auth/` | Sign-up, login, forgot password, email codes, session cookies |
| `src/leaderboard.ts` | `GET /leaderboard` |
| `src/game/manager.ts` | Matchmaking queue, live matches, saving results and Elo |
| `src/game/liveMatch.ts` | One running match: engine actions, 30-second timers, per-player updates |
| `src/game/protocol.ts` | Socket.IO message types and validation |
| `prisma/schema.prisma` | Tables: `User`, `EmailCode`, `Match` |

## HTTP API

The web app calls these through its own `/api/...` path (a Next.js rewrite), so the session cookie stays on the web app's domain. All bodies are JSON. Errors look like `{ "error": "code" }`.

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `POST /auth/signup` | `email, username, password` | `201 { email }`, emails a code | `409 emailTaken / usernameTaken`, `400 invalidInput` |
| `POST /auth/verify-email` | `email, code` | `200 { user }` + cookie | `400 invalidCode / codeExpired / tooManyAttempts` |
| `POST /auth/resend-code` | `email, purpose: "verify" \| "reset"` | `200 { ok }` (always) | |
| `POST /auth/login` | `email, password` | `200 { user }` + cookie | `401 invalidCredentials`, `403 emailNotVerified`, `423 locked { retryAfterSeconds }` |
| `POST /auth/logout` | | `200 { ok }` | |
| `POST /auth/forgot-password` | `email` | `200 { ok }` (always) | |
| `POST /auth/reset-password` | `email, code, newPassword` | `200 { user }` + cookie, other devices logged out | same as verify-email |
| `GET /auth/me` | | `200 { user }` | `401 notLoggedIn` |
| `POST /auth/socket-token` | | `200 { token }` (valid 60 s) | `401 notLoggedIn` |
| `GET /leaderboard?limit=50&offset=0` | | `200 { players: [{ rank, username, elo, wins, losses, draws }] }` | |
| `GET /health` | | `200 ok` | |

`user` is `{ id, email, username, elo, wins, losses, draws }`.

Sign-up, login, resend-code and forgot-password allow 20 requests per 15 minutes per IP.

## Socket.IO protocol

Connect directly to the server (not through `/api`) with a fresh token:

```ts
const { token } = await fetch('/api/auth/socket-token', { method: 'POST' }).then((r) => r.json());
const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, { auth: { token } });
```

**Client → server** (every message takes an ack callback that gets `{ ok: true }` or `{ ok: false, error }`)

| Event | Payload |
|---|---|
| `queue:join` | `{ heroId }`: queue up, or start a match right away with the longest-waiting player within 273 Elo |
| `queue:leave` | |
| `match:action` | `{ type: "attack" }`, `{ type: "offerDraw" }`, `{ type: "respondDraw", accept }`, `{ type: "activatePowerup", powerup }`, `{ type: "pickPowerup", powerup }`, `{ type: "exit" }` |

Action errors are the engine's codes (`notYourTurn`, `powerupNotHeld`, `drawOfferPending`, ...) plus `notInMatch`, `alreadyInMatch` and `invalidInput`.

**Server → client**

| Event | Payload |
|---|---|
| `match:found` | `{ matchId, you, players: [{ username, elo, heroId }, …] }`. Also sent again after a reconnect. |
| `match:update` | `{ matchId, view, events, timers }`. `view` is the engine's `MatchView` for you (the opponent's powerups are only a count). `timers` holds `turnEndsAt`, `drawAnswerEndsAt` and `reconnectEndsAt` as epoch ms, plus `serverNow` for clock correction. |
| `match:ended` | `{ matchId, result, elo: { before, after, delta } \| null, rounds }`. `rounds` is the full log for the fight scene. |
| `session:replaced` | You connected from another tab or device; this connection is being closed. |

**Timers** (GAME_RULES.md section 5)
- **Turn:** the attacker has 30 s to attack, or loses by timeout.
- **Draw offer:** the turn timer pauses while an offer is open. The other player has 30 s to answer; no answer counts as a reject.
- **Reconnect:** a disconnected player has 30 s to come back, or loses. After reconnecting, they get `match:found` and a `match:update` with the current state.

## Limits to know

- The queue and live matches are kept in memory, so a restart or a Render free-plan sleep ends live matches. Running more than one server will need Redis.
- One connection per user: a new tab replaces the old one.
