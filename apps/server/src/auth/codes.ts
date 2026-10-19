// 6-digit email codes for verification and password reset (GAME_RULES.md section 8).

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db.js';
import type { CodePurpose } from '../generated/prisma/client.js';

export const CODE_TTL_MS = 10 * 60_000;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_RESEND_COOLDOWN_MS = 60_000;

export type IssueResult = { ok: true; code: string } | { ok: false; retryAfterMs: number };

export type CheckResult = 'ok' | 'invalid' | 'expired' | 'tooManyAttempts' | 'noCode';

export class CodeService {
  constructor(
    private readonly db: Db,
    private readonly secret: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** Create (or replace) the user's code for `purpose`. Refuses if the last one was sent under 60 seconds ago. */
  async issue(userId: string, purpose: CodePurpose): Promise<IssueResult> {
    const existing = await this.db.emailCode.findUnique({ where: { userId_purpose: { userId, purpose } } });
    if (existing) {
      const wait = existing.sentAt.getTime() + CODE_RESEND_COOLDOWN_MS - this.now();
      if (wait > 0) return { ok: false, retryAfterMs: wait };
    }
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const data = {
      codeHash: this.hash(code),
      attempts: 0,
      expiresAt: new Date(this.now() + CODE_TTL_MS),
      sentAt: new Date(this.now()),
    };
    await this.db.emailCode.upsert({
      where: { userId_purpose: { userId, purpose } },
      create: { userId, purpose, ...data },
      update: data,
    });
    return { ok: true, code };
  }

  /** Check a code. A correct code is used up; 5 wrong tries cancel it. */
  async check(userId: string, purpose: CodePurpose, code: string): Promise<CheckResult> {
    const row = await this.db.emailCode.findUnique({ where: { userId_purpose: { userId, purpose } } });
    if (!row) return 'noCode';
    if (row.expiresAt.getTime() <= this.now()) {
      await this.db.emailCode.delete({ where: { id: row.id } });
      return 'expired';
    }
    const expected = Buffer.from(row.codeHash, 'hex');
    const actual = Buffer.from(this.hash(code), 'hex');
    if (timingSafeEqual(expected, actual)) {
      await this.db.emailCode.delete({ where: { id: row.id } });
      return 'ok';
    }
    if (row.attempts + 1 >= CODE_MAX_ATTEMPTS) {
      await this.db.emailCode.delete({ where: { id: row.id } });
      return 'tooManyAttempts';
    }
    await this.db.emailCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return 'invalid';
  }

  /** HMAC, not a plain hash: there are only a million codes, so a plain hash could be reversed by trying them all. */
  private hash(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }
}
