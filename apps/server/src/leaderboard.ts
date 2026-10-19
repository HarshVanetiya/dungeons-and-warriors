import { Router } from 'express';
import { z } from 'zod';
import type { Db } from './db.js';

const Query = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export function leaderboardRouter(db: Db): Router {
  const r = Router();
  r.get('/', async (req, res) => {
    const { limit, offset } = Query.parse(req.query);
    const players = await db.user.findMany({
      where: { emailVerified: true },
      orderBy: [{ elo: 'desc' }, { wins: 'desc' }, { createdAt: 'asc' }],
      skip: offset,
      take: limit,
      select: { username: true, elo: true, wins: true, losses: true, draws: true },
    });
    res.json({ players: players.map((p, i) => ({ rank: offset + i + 1, ...p })) });
  });
  return r;
}
