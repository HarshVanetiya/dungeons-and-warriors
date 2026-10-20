# Deployment Guide

How to put Dungeon Drill online for free, test it, then move to a custom domain.

| Part | Host | Free URL you'll get |
|---|---|---|
| Frontend (`apps/web`, Next.js) | Vercel | `https://dungeon-drill.vercel.app` |
| Backend (`apps/server`, Express + Socket.IO) | Render | `https://dungeon-drill-api.onrender.com` |
| Database | Neon (Postgres) | none, only a connection string |
| Email codes | Resend | none |

> **Status:** the app code isn't written yet. **Part A (accounts) can be done today.** Parts B–D describe how the code will be deployed. The package names, scripts and environment variables below are the ones the code must use. If the code changes them, update this file.

```
Browser ──https──▶ Vercel (Next.js)  ──/api/* rewrite──▶ Render (Express)  ──▶ Neon (Postgres)
   │                                                        │
   └──────────── WebSocket (Socket.IO) directly ────────────┘──▶ Resend (emails)
```

**Why it's wired this way.** Vercel and Render are on different domains. If the browser called Render directly, the login cookie would be a third-party cookie, and Safari and Chrome block those. So all normal API calls go to the web app's own `/api/...`, and Next.js forwards them to Render. That keeps the cookie on the Vercel domain. Vercel can't forward WebSockets, so the live match connects straight to Render using a short-lived token (`GAME_RULES.md` section 8).

---

## Part A: Create the accounts (do this now)

Use the same GitHub account everywhere; it makes connecting the repo easy.

### A1. Neon (database)
1. Go to <https://neon.tech> → **Sign up** with GitHub.
2. **Create project**: name `dungeon-drill`, Postgres version = latest, region = the one closest to your Render region (pick **AWS Singapore** or **Frankfurt** for India/Europe; whichever you pick, use the same area on Render in B2).
3. Open **Dashboard → Connect**. Copy **two** connection strings and keep them somewhere private (a password manager, not the repo):
   - **Pooled** (host contains `-pooler`) → this becomes `DATABASE_URL`
   - **Direct** (toggle "Connection pooling" off) → this becomes `DIRECT_URL` (used only for database migrations)
   Both end with `?sslmode=require`. Keep that.

### A2. Resend (email)
1. Go to <https://resend.com> → sign up **with the email you want test codes delivered to** (e.g. your Gmail).
2. **API Keys → Create API key**: name `dungeon-drill-test`, permission **Sending access**. Copy it (starts with `re_`). It's shown only once.
3. **Important limit:** until you verify a domain (Part D), Resend can only send:
   - **from** `onboarding@resend.dev`
   - **to** your own Resend account email

   For you alone this works fine. For friends who are testing, set `EMAIL_MODE=log` on Render (B3): the server then writes each code to the Render logs instead of emailing it, and you read it out to them. Switch back to `EMAIL_MODE=resend` after Part D.

### A3. Render (backend)
1. Go to <https://render.com> → **Sign up with GitHub**.
2. When asked, give Render access to `HarshVanetiya/dungeons-and-warriors` only.

### A4. Vercel (frontend)
1. Go to <https://vercel.com> → **Sign up with GitHub** → choose the **Hobby** (free) plan.
2. Give Vercel access to `HarshVanetiya/dungeons-and-warriors` only.

### A5. Make two secrets
Run this twice (any computer with Node) and save both values:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```
- First value → `JWT_SECRET` (signs login cookies)
- Second value → `SOCKET_TOKEN_SECRET` (signs the 60-second match tokens)

Never commit these, and never reuse them between "test" and "real" later.

---

## Part B: Deploy the backend on Render

### B1. What's in the repo (already built)
- Root `package.json` with npm workspaces (`packages/game`, `apps/server`) and the scripts `build:server` (builds `packages/game`, then `apps/server`) and `start:server`.
- Prisma 7. Its database URL lives in `apps/server/prisma.config.ts`, not in `schema.prisma`:
  - migrations use `DIRECT_URL` (falling back to `DATABASE_URL`)
  - the running server uses `DATABASE_URL` (Neon's pooled connection)
- `GET /health` returns `200 ok` without touching the database, so health checks pass quickly while the server wakes up.
- The server handles `SIGTERM` (sent by Render before every redeploy) by closing connections cleanly.

### B2. Create the web service
1. Render dashboard → **New → Web Service** → pick the repo.
2. Fill in:

| Field | Value |
|---|---|
| Name | `dungeon-drill-api` (this becomes the URL) |
| Branch | `main` |
| Region | Same area as your Neon database |
| Root Directory | *(leave empty: repo root, so workspaces work)* |
| Runtime | Node |
| Build Command | `npm ci --include=dev && npm run build:server && npm run db:deploy -w @dungeon-drill/server` |
| Start Command | `npm run start:server` |
| Instance Type | **Free** |

3. Under **Advanced → Health Check Path**: `/health`.
4. **Auto-Deploy**: On commit (every push to `main` redeploys).

The migration runs in the build command because pre-deploy commands aren't on Render's free plan.

`--include=dev` matters: `NODE_ENV=production` (B3) makes a plain `npm ci` skip dev dependencies, and the build needs TypeScript and the Prisma CLI.

### B3. Environment variables (Render → service → Environment)

| Key | Value |
|---|---|
| `NODE_VERSION` | `22` |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon **pooled** string (A1) |
| `DIRECT_URL` | Neon **direct** string (A1) |
| `JWT_SECRET` | from A5 |
| `SOCKET_TOKEN_SECRET` | from A5 |
| `WEB_ORIGIN` | `https://dungeon-drill.vercel.app` (fill in after C2; used for CORS on the socket) |
| `RESEND_API_KEY` | from A2 |
| `EMAIL_FROM` | `Dungeon Drill <onboarding@resend.dev>` |
| `EMAIL_MODE` | `resend` if only you test; `log` if friends test (see A2) |

Don't set `PORT`. Render sets it, and the server must listen on `process.env.PORT`.

### B4. Check it
1. Click **Manual Deploy → Deploy latest commit** and watch **Logs**: build → migrate → "listening on …".
2. Open `https://dungeon-drill-api.onrender.com/health` → should show `ok`.

**Free-plan behaviour:** after 15 minutes with no requests, the server sleeps; the next request takes about a minute to wake it. Sleeping or redeploying ends any live match. That's fine while testing. Optional: a free uptime monitor (e.g. UptimeRobot) pinging `/health` every 10 minutes keeps it awake. Render's free plan includes 750 hours a month, enough for one service running all month.

---

## Part C: Deploy the frontend on Vercel

### C1. What's in the repo (already built)
- `apps/web` is a Next.js 16 app. `next.config.ts` forwards `/api/*` to `API_URL`.
- Its `build` script builds `packages/game` first, then runs `next build`.
- `API_URL` and `NEXT_PUBLIC_SOCKET_URL` are baked in **when the app is built**. After changing either one, redeploy.

### C2. Import the project
1. Vercel dashboard → **Add New → Project** → import the repo.
2. Fill in:

| Field | Value |
|---|---|
| Project Name | `dungeon-drill` (this becomes the URL) |
| Framework Preset | Next.js |
| Root Directory | `apps/web` |
| Install Command | Override: `cd ../.. && npm ci` (installs the whole workspace, including `packages/game`) |
| Build Command | leave default (`npm run build`) |
| Output Directory | leave default |

3. **Environment Variables** (apply to Production and Preview):

| Key | Value |
|---|---|
| `API_URL` | `https://dungeon-drill-api.onrender.com` (used by the `/api` rewrite) |
| `NEXT_PUBLIC_SOCKET_URL` | `https://dungeon-drill-api.onrender.com` (the browser connects the socket here) |

4. **Deploy.** You get `https://dungeon-drill.vercel.app`.
5. Go back to Render (B3): set `WEB_ORIGIN` to this exact URL → **Save** (Render redeploys).

Every push to `main` now redeploys both. Vercel also makes a preview URL for each pull request. Those previews won't be in `WEB_ORIGIN`, so live matches only work on the main URL. That's expected.

---

## Testing checklist (on the free URLs)

Use two browsers (e.g. Chrome and a Firefox private window) so you can be both players.

**Accounts**
- [ ] Sign up → the code arrives (your email, or Render **Logs** if `EMAIL_MODE=log`) → entering it verifies the account
- [ ] Wrong code 5× → code is cancelled; "Resend" is blocked for 60 seconds
- [ ] Log in, refresh the page → still logged in (cookie works)
- [ ] 5 wrong passwords → locked for 15 minutes
- [ ] Forgot password → code → new password works, old one doesn't, the other browser gets logged out

**Game**
- [ ] Both players queue → matched (ratings within 273)
- [ ] Rolls, damage and counter damage match `GAME_RULES.md`
- [ ] Energy fills, powerup offer appears, powerups work on attack and defence
- [ ] Draw offer: accept, reject, and no answer
- [ ] Exit button → that player loses; Elo changes on both accounts
- [ ] Close one tab for over 30 seconds → that player loses
- [ ] End-of-match fight scene plays
- [ ] Leaderboard shows both players

**Cold start**
- [ ] Wait 20 minutes, open the site → "Waking up the server…" shows, then everything works

If something fails: check Render **Logs** first (server errors, emails in `log` mode), then the browser console (F12) for the frontend.

---

## Part D: Move to a custom domain (after testing)

Example domain: `dungeondrill.com`. Any registrar works (Cloudflare Registrar, Namecheap, Porkbun).

| Address | Points to |
|---|---|
| `dungeondrill.com` (and `www`) | Vercel (frontend) |
| `api.dungeondrill.com` | Render (backend) |
| `mail.dungeondrill.com` records | Resend (sending) |

1. **Buy the domain.**
2. **Vercel:** project → **Settings → Domains** → add `dungeondrill.com` and `www.dungeondrill.com`. Copy the DNS records it shows into your registrar. Wait until Vercel shows **Valid Configuration**.
3. **Render:** service → **Settings → Custom Domains** → add `api.dungeondrill.com`. Add the CNAME it shows at your registrar. Render issues the HTTPS certificate automatically.
4. **Resend:** **Domains → Add Domain** → `dungeondrill.com`. Add the TXT/MX records it shows (SPF and DKIM; also add the suggested DMARC record). Click **Verify** once DNS has updated (minutes to a few hours).
5. **Update environment variables:**

| Where | Key | New value |
|---|---|---|
| Render | `WEB_ORIGIN` | `https://dungeondrill.com` |
| Render | `EMAIL_FROM` | `Dungeon Drill <no-reply@dungeondrill.com>` |
| Render | `EMAIL_MODE` | `resend` |
| Vercel | `API_URL` | `https://api.dungeondrill.com` |
| Vercel | `NEXT_PUBLIC_SOCKET_URL` | `https://api.dungeondrill.com` |

6. **Redeploy both.** Vercel needs a redeploy to pick up new `API_URL` / `NEXT_PUBLIC_SOCKET_URL` values.
7. **Run the testing checklist again**, now with a friend's real email to confirm codes reach anyone.

Now the frontend and API share one domain, so the `/api` rewrite is optional, but keep it. It still works and means no code change.

---

## Later: moving off the free plans

- **Database to Azure or GCP Postgres:** create the managed Postgres → `pg_dump` from Neon → `pg_restore` into the new one → change `DATABASE_URL` / `DIRECT_URL`. No code changes.
- **Backend:** a paid Render instance (no sleep), or a container on Azure Container Apps / Google Cloud Run. Running more than one server needs Redis for the matchmaking queue and live matches (`GAME_RULES.md` section 10).
- **Frontend:** Vercel Pro once the game makes money (Hobby is non-commercial only).
- **Never** reuse test secrets: make new `JWT_SECRET` and `SOCKET_TOKEN_SECRET` values for the real launch.
