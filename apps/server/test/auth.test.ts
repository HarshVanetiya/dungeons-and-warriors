import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CODE_MAX_ATTEMPTS } from '../src/auth/codes.js';
import { LOGIN_MAX_FAILURES } from '../src/auth/routes.js';
import { createUser, hasDb, resetDb, startServer, testDb, type TestServer } from './helpers.js';

const EMAIL = 'hero@example.com';
const PASSWORD = 'correct horse';

describe.skipIf(!hasDb)('auth', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(() => server.close());
  beforeEach(async () => {
    await resetDb();
    server.outbox.length = 0;
  });

  const agent = () => request.agent(server.app);
  const signUp = (a = agent(), body: object = {}) =>
    a.post('/auth/signup').send({ email: EMAIL, username: 'Hero_1', password: PASSWORD, ...body });

  /** Sign up and verify; returns a logged-in agent. */
  async function verifiedAgent() {
    const a = agent();
    await signUp(a).expect(201);
    await a.post('/auth/verify-email').send({ email: EMAIL, code: server.lastCode(EMAIL) }).expect(200);
    return a;
  }

  describe('sign-up and email verification', () => {
    it('emails a 6-digit code and logs in once it is entered', async () => {
      const a = agent();
      await signUp(a, { email: ' Hero@Example.com ' }).expect(201, { email: EMAIL });
      expect(server.outbox).toHaveLength(1);
      await a.get('/auth/me').expect(401); // not verified yet

      const res = await a.post('/auth/verify-email').send({ email: EMAIL, code: server.lastCode(EMAIL) }).expect(200);
      expect(res.body.user).toMatchObject({ email: EMAIL, username: 'Hero_1', elo: 1200, wins: 0 });
      await a.get('/auth/me').expect(200);
    });

    it('stores an argon2id hash, never the password', async () => {
      await signUp().expect(201);
      const user = await testDb().user.findUniqueOrThrow({ where: { email: EMAIL } });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
      const code = await testDb().emailCode.findFirstOrThrow({ where: { userId: user.id } });
      expect(code.codeHash).not.toBe(server.lastCode(EMAIL));
    });

    it('rejects a taken email or username', async () => {
      await verifiedAgent();
      await signUp().expect(409, { error: 'emailTaken' });
      await signUp(agent(), { email: 'other@example.com', username: 'hero_1' }).expect(409, { error: 'usernameTaken' });
    });

    it('lets an unverified sign-up be repeated with a different username', async () => {
      await signUp().expect(201);
      await signUp(agent(), { username: 'Better' }).expect(201);
      expect(await testDb().user.count()).toBe(1);
    });

    it('validates input', async () => {
      const res = await signUp(agent(), { email: 'nope', username: 'a', password: 'short' }).expect(400);
      expect(res.body.error).toBe('invalidInput');
      expect(res.body.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'password', 'username']);
    });

    it(`cancels the code after ${CODE_MAX_ATTEMPTS} wrong tries`, async () => {
      await signUp().expect(201);
      const right = server.lastCode(EMAIL);
      const wrong = right === '000000' ? '111111' : '000000';
      for (let i = 1; i < CODE_MAX_ATTEMPTS; i++) {
        await agent().post('/auth/verify-email').send({ email: EMAIL, code: wrong }).expect(400, { error: 'invalidCode' });
      }
      await agent().post('/auth/verify-email').send({ email: EMAIL, code: wrong }).expect(400, { error: 'tooManyAttempts' });
      await agent().post('/auth/verify-email').send({ email: EMAIL, code: right }).expect(400, { error: 'invalidCode' });
    });

    it('rejects an expired code', async () => {
      await signUp().expect(201);
      await testDb().emailCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      await agent().post('/auth/verify-email').send({ email: EMAIL, code: server.lastCode(EMAIL) }).expect(400, { error: 'codeExpired' });
    });

    it('resends at most once a minute', async () => {
      await signUp().expect(201);
      await agent().post('/auth/resend-code').send({ email: EMAIL, purpose: 'verify' }).expect(200);
      expect(server.outbox).toHaveLength(1); // too soon: nothing sent
      await testDb().emailCode.updateMany({ data: { sentAt: new Date(Date.now() - 61_000) } });
      await agent().post('/auth/resend-code').send({ email: EMAIL, purpose: 'verify' }).expect(200);
      expect(server.outbox).toHaveLength(2);
    });

    it('answers resend-code the same way for unknown emails', async () => {
      await agent().post('/auth/resend-code').send({ email: 'ghost@example.com', purpose: 'verify' }).expect(200, { ok: true });
      expect(server.outbox).toHaveLength(0);
    });
  });

  describe('login', () => {
    it('logs in with email and password and out again', async () => {
      await verifiedAgent();
      const a = agent();
      const res = await a.post('/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
      expect(res.headers['set-cookie']?.[0]).toMatch(/dd_session=.*HttpOnly.*SameSite=Lax/);
      await a.get('/auth/me').expect(200);
      await a.post('/auth/logout').expect(200);
      await a.get('/auth/me').expect(401);
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      await verifiedAgent();
      await agent().post('/auth/login').send({ email: EMAIL, password: 'wrong password' }).expect(401, { error: 'invalidCredentials' });
      await agent().post('/auth/login').send({ email: 'ghost@example.com', password: PASSWORD }).expect(401, { error: 'invalidCredentials' });
    });

    it('sends an unverified account back to the code screen', async () => {
      await signUp().expect(201);
      await testDb().emailCode.updateMany({ data: { sentAt: new Date(Date.now() - 61_000) } });
      await agent().post('/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(403, { error: 'emailNotVerified' });
      expect(server.outbox).toHaveLength(2); // a fresh code was sent
    });

    it(`locks the account for 15 minutes after ${LOGIN_MAX_FAILURES} wrong passwords`, async () => {
      await verifiedAgent();
      for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
        await agent().post('/auth/login').send({ email: EMAIL, password: 'wrong password' }).expect(401);
      }
      const res = await agent().post('/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(423);
      expect(res.body.error).toBe('locked');
      expect(res.body.retryAfterSeconds).toBeGreaterThan(14 * 60);

      await testDb().user.updateMany({ data: { lockedUntil: new Date(Date.now() - 1000) } });
      await agent().post('/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(200);
    });
  });

  describe('forgot password', () => {
    it('resets the password with an emailed code and logs out every other device', async () => {
      const oldDevice = await verifiedAgent();
      await agent().post('/auth/forgot-password').send({ email: EMAIL }).expect(200, { ok: true });

      const newDevice = agent();
      await newDevice
        .post('/auth/reset-password')
        .send({ email: EMAIL, code: server.lastCode(EMAIL), newPassword: 'brand new password' })
        .expect(200);

      await newDevice.get('/auth/me').expect(200);
      await oldDevice.get('/auth/me').expect(401);
      await agent().post('/auth/login').send({ email: EMAIL, password: PASSWORD }).expect(401);
      await agent().post('/auth/login').send({ email: EMAIL, password: 'brand new password' }).expect(200);
    });

    it('answers the same way for unknown emails and sends nothing', async () => {
      await agent().post('/auth/forgot-password').send({ email: 'ghost@example.com' }).expect(200, { ok: true });
      expect(server.outbox).toHaveLength(0);
    });

    it('does not accept the email-verification code as a reset code', async () => {
      await signUp().expect(201);
      await agent()
        .post('/auth/reset-password')
        .send({ email: EMAIL, code: server.lastCode(EMAIL), newPassword: 'brand new password' })
        .expect(400, { error: 'invalidCode' });
    });
  });

  describe('socket token and leaderboard', () => {
    it('only gives socket tokens to logged-in players', async () => {
      await agent().post('/auth/socket-token').expect(401);
      const res = await (await verifiedAgent()).post('/auth/socket-token').expect(200);
      expect(typeof res.body.token).toBe('string');
    });

    it('ranks verified players by Elo', async () => {
      await createUser('Low', 1100);
      await createUser('High', 1400);
      await createUser('Mid', 1250);
      await testDb().user.create({ data: { email: 'u@example.com', username: 'Unverified', passwordHash: 'x', elo: 2000 } });
      const res = await agent().get('/leaderboard?limit=2').expect(200);
      expect(res.body.players).toEqual([
        { rank: 1, username: 'High', elo: 1400, wins: 0, losses: 0, draws: 0 },
        { rank: 2, username: 'Mid', elo: 1250, wins: 0, losses: 0, draws: 0 },
      ]);
      const page2 = await agent().get('/leaderboard?limit=2&offset=2').expect(200);
      expect(page2.body.players).toEqual([{ rank: 3, username: 'Low', elo: 1100, wins: 0, losses: 0, draws: 0 }]);
    });
  });

  it('answers /health', async () => {
    await agent().get('/health').expect(200, 'ok');
  });
});
