import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createUser, hasDb, player, resetDb, startServer, testDb, waitFor, type TestServer } from './helpers.js';

type Player = Awaited<ReturnType<typeof player>>;

describe.skipIf(!hasDb)('live matches', () => {
  let server: TestServer;
  const open: Player[] = [];
  beforeAll(async () => {
    server = await startServer();
  });
  afterAll(() => server.close());
  beforeEach(() => resetDb());
  afterEach(() => {
    for (const p of open.splice(0)) p.socket.disconnect();
  });

  async function connect(username: string, elo = 1200) {
    const user = await createUser(username, elo);
    const p = await player(server, user);
    open.push(p);
    return { user, p };
  }

  /** Two players in a match; returns them as attacker and defender for round 1. */
  async function startMatch() {
    const a = await connect('Alice');
    const b = await connect('Bob');
    expect(await a.p.queue('knight')).toEqual({ ok: true });
    expect(await b.p.queue('monk')).toEqual({ ok: true });
    await waitFor(() => a.p.updates.length > 0 && b.p.updates.length > 0);
    const attackerIsA = a.p.latest().view.attacker === a.p.latest().view.you;
    return attackerIsA ? { attacker: a, defender: b } : { attacker: b, defender: a };
  }

  const ended = (p: Player) => waitFor(() => p.ended[0]);

  it('matches two queued players and tells each who they are', async () => {
    const { attacker, defender } = await startMatch();
    const [fa, fd] = [attacker.p.found[0]!, defender.p.found[0]!];
    expect(fa.matchId).toBe(fd.matchId);
    expect(fa.you).not.toBe(fd.you);
    expect(fa.players.map((p) => p.username).sort()).toEqual(['Alice', 'Bob']);
    expect(attacker.p.latest().timers.turnEndsAt).toBeGreaterThan(Date.now());
  });

  it("never sends the opponent's powerups, only the count", async () => {
    const { defender } = await startMatch();
    const view = defender.p.latest().view;
    expect(view.opponent).toEqual({ heroId: expect.any(String), hp: expect.any(Number), energy: 0, heldCount: 0 });
    expect(view.opponent).not.toHaveProperty('held');
  });

  it('only lets the attacker attack, and validates input', async () => {
    const { attacker, defender } = await startMatch();
    expect(await defender.p.action({ type: 'attack' })).toEqual({ ok: false, error: 'notYourTurn' });
    expect(await attacker.p.action({ type: 'teleport' })).toEqual({ ok: false, error: 'invalidInput' });
    expect(await attacker.p.action({ type: 'activatePowerup', powerup: 'nuke' })).toEqual({ ok: false, error: 'invalidInput' });
    expect(await attacker.p.action({ type: 'attack' })).toEqual({ ok: true });
    await waitFor(() => defender.p.latest().view.rounds.length === 1);
  });

  it('plays a full match to a knockout and saves it', async () => {
    const { attacker, defender } = await startMatch();
    const players = [attacker.p, defender.p];
    while (players[0]!.ended.length === 0) {
      const view = players[0]!.latest().view;
      if (view.status === 'finished') break;
      const current = players.find((p) => p.latest().view.you === view.attacker)!;
      const rounds = view.rounds.length;
      expect(await current.action({ type: 'attack' })).toEqual({ ok: true });
      await waitFor(() => players[0]!.latest().view.rounds.length > rounds);
    }
    const result = await ended(attacker.p);
    expect(result.result.kind).toBe('knockout');
    expect(result.rounds.length).toBeGreaterThan(0);
    expect(await testDb().match.count()).toBe(1);
  });

  it('makes a player who exits lose, and moves Elo by 16 for equal ratings', async () => {
    const { attacker, defender } = await startMatch();
    expect(await defender.p.action({ type: 'exit' })).toEqual({ ok: true });
    const forAttacker = await ended(attacker.p);
    const forDefender = await ended(defender.p);
    expect(forAttacker.result).toMatchObject({ kind: 'exit' });
    expect(forAttacker.elo).toEqual({ before: 1200, after: 1216, delta: 16 });
    expect(forDefender.elo).toEqual({ before: 1200, after: 1184, delta: -16 });

    const [w, l] = await Promise.all([
      testDb().user.findUniqueOrThrow({ where: { id: attacker.user.id } }),
      testDb().user.findUniqueOrThrow({ where: { id: defender.user.id } }),
    ]);
    expect([w.elo, w.wins, l.elo, l.losses]).toEqual([1216, 1, 1184, 1]);
    const saved = await testDb().match.findFirstOrThrow();
    expect(saved).toMatchObject({ result: 'EXIT', winnerId: attacker.user.id });
  });

  it('makes the attacker lose if they do not attack in time', async () => {
    const { attacker, defender } = await startMatch();
    const result = await ended(defender.p);
    expect(result.result).toEqual({ kind: 'timeout', winner: attacker.p.latest().view.you === 0 ? 1 : 0 });
  });

  it('ends in a draw when both agree, with no Elo change', async () => {
    const { attacker, defender } = await startMatch();
    expect(await attacker.p.action({ type: 'offerDraw' })).toEqual({ ok: true });
    await waitFor(() => defender.p.latest().view.drawOffer);
    expect(defender.p.latest().timers.turnEndsAt).toBeNull(); // paused while deciding
    expect(await defender.p.action({ type: 'respondDraw', accept: true })).toEqual({ ok: true });
    const result = await ended(attacker.p);
    expect(result.result).toEqual({ kind: 'draw' });
    expect(result.elo).toEqual({ before: 1200, after: 1200, delta: 0 });
    const user = await testDb().user.findUniqueOrThrow({ where: { id: attacker.user.id } });
    expect([user.elo, user.draws]).toEqual([1200, 1]);
  });

  it('counts an unanswered draw offer as rejected and resumes the turn timer', async () => {
    const { attacker, defender } = await startMatch();
    await attacker.p.action({ type: 'offerDraw' });
    await waitFor(() => attacker.p.updates.some((u) => u.events.some((e) => e.type === 'drawRejected')));
    expect(defender.p.ended).toHaveLength(0);
    expect(attacker.p.latest().timers.turnEndsAt).not.toBeNull();
    expect(attacker.p.latest().view.canOfferDraw).toBe(false);
  });

  it('makes a player lose if they stay disconnected', async () => {
    const { attacker, defender } = await startMatch();
    defender.p.socket.disconnect();
    await waitFor(() => attacker.p.latest().timers.reconnectEndsAt.some((t) => t !== null));
    const result = await ended(attacker.p);
    expect(result.result).toMatchObject({ kind: 'disconnect' });
  });

  it('lets a disconnected player come back and carry on', async () => {
    const { attacker, defender } = await startMatch();
    defender.p.socket.disconnect();
    await waitFor(() => attacker.p.latest().timers.reconnectEndsAt.some((t) => t !== null));
    const back = await player(server, defender.user);
    open.push(back);
    await waitFor(() => back.found[0]);
    await waitFor(() => attacker.p.latest().timers.reconnectEndsAt.every((t) => t === null));
    expect(await attacker.p.action({ type: 'attack' })).toEqual({ ok: true });
    await waitFor(() => back.latest().view.rounds.length === 1);
  });

  it('replaces an older connection for the same user', async () => {
    const a = await connect('Alice');
    let replaced = false;
    a.p.socket.on('session:replaced', () => void (replaced = true));
    open.push(await player(server, a.user));
    await waitFor(() => replaced);
  });

  it('refuses to queue a player who is already in a match', async () => {
    const { attacker } = await startMatch();
    expect(await attacker.p.queue('rogue')).toEqual({ ok: false, error: 'alreadyInMatch' });
  });

  it('only matches players within 273 Elo, longest-waiting first', async () => {
    const low = await connect('Low', 1200);
    const high = await connect('High', 1500);
    await low.p.queue('knight');
    await high.p.queue('knight');
    await new Promise((r) => setTimeout(r, 50));
    expect(low.p.found).toHaveLength(0);
    expect(server.manager.isQueued(low.user.id) && server.manager.isQueued(high.user.id)).toBe(true);

    const mid = await connect('Mid', 1300); // within range of both; Low has waited longest
    await mid.p.queue('rogue');
    await waitFor(() => mid.p.found[0]);
    expect(mid.p.found[0]!.players.map((p) => p.username).sort()).toEqual(['Low', 'Mid']);
    expect(server.manager.isQueued(high.user.id)).toBe(true);
  });
});
