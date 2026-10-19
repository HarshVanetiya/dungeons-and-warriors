// Sign-up, login and forgot-password (GAME_RULES.md section 8).

import { Router, type Response } from 'express';
import { z } from 'zod';
import type { Db } from '../db.js';
import { codeEmail, type EmailSender } from '../email.js';
import type { User } from '../generated/prisma/client.js';
import { CodeService, type CheckResult } from './codes.js';
import { PASSWORD_MAX, PASSWORD_MIN, hashPassword, verifyAgainstDummy, verifyPassword } from './passwords.js';
import { Sessions, publicUser } from './session.js';

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60_000;

const email = z.string().trim().toLowerCase().email().max(254);
const password = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);
const username = z.string().trim().regex(/^[A-Za-z0-9_]{3,16}$/, '3-16 letters, numbers or _');
const code = z.string().trim().regex(/^\d{6}$/, '6 digits');

const SignUp = z.object({ email, username, password });
const VerifyEmail = z.object({ email, code });
const ResendCode = z.object({ email, purpose: z.enum(['verify', 'reset']) });
const Login = z.object({ email, password: z.string().max(PASSWORD_MAX) });
const ForgotPassword = z.object({ email });
const ResetPassword = z.object({ email, code, newPassword: password });

interface Deps {
  db: Db;
  sessions: Sessions;
  codes: CodeService;
  email: EmailSender;
  now?: () => number;
}

export function authRouter({ db, sessions, codes, email: mailer, now = Date.now }: Deps): Router {
  const r = Router();

  /** Issue a code and email it. Silently does nothing if one was sent less than 60 seconds ago. */
  const sendCode = async (user: User, purpose: 'verify' | 'reset') => {
    const issued = await codes.issue(user.id, purpose === 'verify' ? 'VERIFY_EMAIL' : 'RESET_PASSWORD');
    if (issued.ok) await mailer.send({ to: user.email, ...codeEmail(purpose, issued.code) });
  };

  r.post('/signup', async (req, res) => {
    const body = SignUp.parse(req.body);
    const existing = await db.user.findUnique({ where: { email: body.email } });
    if (existing?.emailVerified) return void res.status(409).json({ error: 'emailTaken' });

    const nameOwner = await db.user.findFirst({ where: { username: { equals: body.username, mode: 'insensitive' } } });
    if (nameOwner && nameOwner.id !== existing?.id) return void res.status(409).json({ error: 'usernameTaken' });

    const passwordHash = await hashPassword(body.password);
    // an unverified sign-up can be repeated, e.g. after typing the wrong username
    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { username: body.username, passwordHash } })
      : await db.user.create({ data: { email: body.email, username: body.username, passwordHash } });
    await sendCode(user, 'verify');
    res.status(201).json({ email: user.email });
  });

  r.post('/verify-email', async (req, res) => {
    const body = VerifyEmail.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user || user.emailVerified) return void codeError(res, 'noCode');
    const result = await codes.check(user.id, 'VERIFY_EMAIL', body.code);
    if (result !== 'ok') return void codeError(res, result);
    const verified = await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    sessions.setCookie(res, verified);
    res.json({ user: publicUser(verified) });
  });

  // Always answers the same way, so it can't be used to find out who has an account.
  r.post('/resend-code', async (req, res) => {
    const body = ResendCode.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (user && (body.purpose === 'reset' || !user.emailVerified)) await sendCode(user, body.purpose);
    res.json({ ok: true });
  });

  r.post('/login', async (req, res) => {
    const body = Login.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user) {
      await verifyAgainstDummy(body.password);
      return void res.status(401).json({ error: 'invalidCredentials' });
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > now()) {
      const retryAfterSeconds = Math.ceil((user.lockedUntil.getTime() - now()) / 1000);
      return void res.status(423).json({ error: 'locked', retryAfterSeconds });
    }
    if (!(await verifyPassword(user.passwordHash, body.password))) {
      const failures = user.failedLoginCount + 1;
      const locked = failures >= LOGIN_MAX_FAILURES;
      await db.user.update({
        where: { id: user.id },
        data: locked ? { failedLoginCount: 0, lockedUntil: new Date(now() + LOGIN_LOCK_MS) } : { failedLoginCount: failures },
      });
      return void res.status(401).json({ error: 'invalidCredentials' });
    }
    if (user.failedLoginCount > 0 || user.lockedUntil) {
      await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
    }
    if (!user.emailVerified) {
      await sendCode(user, 'verify');
      return void res.status(403).json({ error: 'emailNotVerified' });
    }
    sessions.setCookie(res, user);
    res.json({ user: publicUser(user) });
  });

  r.post('/logout', (_req, res) => {
    sessions.clearCookie(res);
    res.json({ ok: true });
  });

  // Same answer whether or not the account exists.
  r.post('/forgot-password', async (req, res) => {
    const body = ForgotPassword.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (user) await sendCode(user, 'reset');
    res.json({ ok: true });
  });

  r.post('/reset-password', async (req, res) => {
    const body = ResetPassword.parse(req.body);
    const user = await db.user.findUnique({ where: { email: body.email } });
    if (!user) return void codeError(res, 'noCode');
    const result = await codes.check(user.id, 'RESET_PASSWORD', body.code);
    if (result !== 'ok') return void codeError(res, result);
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(body.newPassword),
        sessionVersion: { increment: 1 }, // logs out every other device
        emailVerified: true, // they just proved they own the inbox
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    sessions.setCookie(res, updated);
    res.json({ user: publicUser(updated) });
  });

  r.get('/me', sessions.requireUser, (_req, res) => {
    res.json({ user: publicUser(res.locals.user as User) });
  });

  r.post('/socket-token', sessions.requireUser, (_req, res) => {
    res.json({ token: sessions.socketToken(res.locals.user as User) });
  });

  return r;
}

const CODE_ERRORS: Record<Exclude<CheckResult, 'ok'>, string> = {
  invalid: 'invalidCode',
  noCode: 'invalidCode',
  expired: 'codeExpired', // ask for a new code
  tooManyAttempts: 'tooManyAttempts', // ask for a new code
};

function codeError(res: Response, result: Exclude<CheckResult, 'ok'>): void {
  res.status(400).json({ error: CODE_ERRORS[result] });
}
