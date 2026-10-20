import cookieParser from 'cookie-parser';
import express, { type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { createServer as createHttpServer } from 'node:http';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import type { Rng } from '@dungeon-drill/game';
import { CodeService } from './auth/codes.js';
import { authRouter } from './auth/routes.js';
import { Sessions } from './auth/session.js';
import { GAME_TIMINGS, type Config, type Timings } from './config.js';
import type { Db } from './db.js';
import type { EmailSender } from './email.js';
import { MatchManager } from './game/manager.js';
import { attachSockets, type GameServer } from './game/socket.js';
import { leaderboardRouter } from './leaderboard.js';

export interface ServerDeps {
  config: Config;
  db: Db;
  email: EmailSender;
  timings?: Timings;
  rng?: Rng;
  /** Per-IP limit on sign-up, login and email-sending routes. Tests turn it off. */
  rateLimit?: boolean;
}

export function createServer({ config, db, email, timings = GAME_TIMINGS, rng, rateLimit: limit = true }: ServerDeps) {
  const app = express();
  app.set('trust proxy', config.TRUST_PROXY_HOPS);
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  const sessions = new Sessions(config, db);
  const codes = new CodeService(db, config.JWT_SECRET);

  app.get('/health', (_req, res) => {
    res.type('text').send('ok');
  });

  if (limit) {
    // 20 tries per 15 minutes per IP on each route, mainly so nobody can burn through the daily email quota
    for (const path of ['/auth/signup', '/auth/login', '/auth/resend-code', '/auth/forgot-password']) {
      app.use(
        path,
        rateLimit({
          windowMs: 15 * 60_000,
          limit: 20,
          standardHeaders: 'draft-8',
          legacyHeaders: false,
          message: { error: 'rateLimited' },
        }),
      );
    }
  }
  app.use('/auth', authRouter({ db, sessions, codes, email }));
  app.use('/leaderboard', leaderboardRouter(db));

  app.use((_req, res) => {
    res.status(404).json({ error: 'notFound' });
  });
  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalidInput', details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) });
      return;
    }
    if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalidJson' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'serverError' });
  };
  app.use(onError);

  const httpServer = createHttpServer(app);
  const io: GameServer = new Server(httpServer, {
    cors: { origin: config.WEB_ORIGIN },
    // notice closed tabs within ~20 seconds; the 30-second reconnect window starts then
    pingInterval: 10_000,
    pingTimeout: 10_000,
  });
  const manager = new MatchManager(db, timings, rng);
  attachSockets(io, sessions, manager);

  return { app, httpServer, io, manager, sessions };
}
