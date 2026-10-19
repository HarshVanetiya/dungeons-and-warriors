import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import type { Config } from '../config.js';
import type { Db } from '../db.js';
import type { User } from '../generated/prisma/client.js';

export const SESSION_COOKIE = 'dd_session';
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const SOCKET_TOKEN_TTL_SECONDS = 60;

interface SessionClaims {
  sub: string;
  /** Must match User.sessionVersion; a password reset bumps it and logs out every device. */
  ver: number;
  typ: 'session' | 'socket';
}

export class Sessions {
  constructor(
    private readonly config: Config,
    private readonly db: Db,
  ) {}

  setCookie(res: Response, user: Pick<User, 'id' | 'sessionVersion'>): void {
    const token = jwt.sign({ ver: user.sessionVersion, typ: 'session' }, this.config.JWT_SECRET, {
      subject: user.id,
      expiresIn: SESSION_TTL_SECONDS,
    });
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  /** Short-lived token the web app passes when opening the Socket.IO connection (GAME_RULES.md section 8). */
  socketToken(user: Pick<User, 'id' | 'sessionVersion'>): string {
    return jwt.sign({ ver: user.sessionVersion, typ: 'socket' }, this.config.SOCKET_TOKEN_SECRET, {
      subject: user.id,
      expiresIn: SOCKET_TOKEN_TTL_SECONDS,
    });
  }

  async userFromSessionCookie(req: Request): Promise<User | null> {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    return typeof token === 'string' ? this.userFromToken(token, this.config.JWT_SECRET, 'session') : null;
  }

  userFromSocketToken(token: unknown): Promise<User | null> {
    return typeof token === 'string'
      ? this.userFromToken(token, this.config.SOCKET_TOKEN_SECRET, 'socket')
      : Promise.resolve(null);
  }

  /** Express middleware: 401 unless logged in with a verified account. Puts the user in res.locals.user. */
  requireUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = await this.userFromSessionCookie(req);
    if (!user) {
      res.status(401).json({ error: 'notLoggedIn' });
      return;
    }
    res.locals.user = user;
    next();
  };

  private async userFromToken(token: string, secret: string, typ: SessionClaims['typ']): Promise<User | null> {
    let claims: SessionClaims;
    try {
      claims = jwt.verify(token, secret) as SessionClaims;
    } catch {
      return null;
    }
    if (claims.typ !== typ) return null;
    const user = await this.db.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.sessionVersion !== claims.ver || !user.emailVerified) return null;
    return user;
  }
}

export function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    elo: user.elo,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  };
}
