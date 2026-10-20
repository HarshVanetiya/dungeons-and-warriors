'use client';

// End-of-match cinematic (GAME_RULES.md section 9): replays the last rounds with hit-stop,
// camera shake and a slow-motion knockout. Drawn with PixiJS using the placeholder silhouettes.

import { HEROES, type HeroId, type MatchResult, type PlayerIndex, type RoundResult } from '@dungeon-drill/game';
import type { Application, Container, Graphics, Ticker } from 'pixi.js';
import { useEffect, useRef } from 'react';
import { FIGURES, FIGURE_COLORS } from '@/lib/figures';
import { HERO_STYLE } from '@/lib/heroes';

type Pixi = typeof import('pixi.js');

export interface FightSceneProps {
  rounds: RoundResult[];
  heroes: [HeroId, HeroId];
  names: [string, string];
  you: PlayerIndex;
  result: MatchResult;
  onDone: () => void;
}

const REPLAY_ROUNDS = 3;

export function FightScene(props: FightSceneProps) {
  const host = useRef<HTMLDivElement>(null);
  const done = useRef(props.onDone);
  done.current = props.onDone;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      done.current();
      return;
    }
    let disposed = false;
    let app: Application | null = null;
    void (async () => {
      const PIXI = await import('pixi.js');
      const a = new PIXI.Application();
      await a.init({ resizeTo: host.current!, backgroundAlpha: 0, antialias: true, autoDensity: true, resolution: Math.min(window.devicePixelRatio, 2) });
      if (disposed) return a.destroy(true, { children: true });
      app = a;
      host.current!.appendChild(a.canvas);
      await play(PIXI, a, props, () => disposed);
      if (!disposed) done.current();
    })();
    return () => {
      disposed = true;
      app?.destroy(true, { children: true });
    };
  }, []); // runs once per match

  return (
    <div className="relative h-[60vh] min-h-80 w-full overflow-hidden rounded-xl border border-stone-800 bg-[radial-gradient(ellipse_80%_60%_at_50%_95%,rgb(249_115_22/0.16),transparent_70%),linear-gradient(180deg,#100c18,#050407)]">
      <div ref={host} className="absolute inset-0" />
      <button
        type="button"
        onClick={() => done.current()}
        className="absolute right-3 bottom-3 rounded-md bg-black/50 px-3 py-1.5 text-sm text-ash ring-1 ring-stone-700 hover:text-bone"
      >
        Skip
      </button>
    </div>
  );
}

async function play(PIXI: Pixi, app: Application, { rounds, heroes, names, you, result }: FightSceneProps, disposed: () => boolean) {
  const W = app.screen.width;
  const H = app.screen.height;
  const floorY = H * 0.86;
  const scale = (H * 0.5) / 160;
  const displayFont = getComputedStyle(document.documentElement).getPropertyValue('--font-cinzel').trim() || 'serif';

  let timeScale = 1;
  let shake = 0;
  const world = new PIXI.Container();
  world.pivot.set(W / 2, H / 2);
  world.position.set(W / 2, H / 2);
  app.stage.addChild(world);

  // ---- tiny animation engine on the Pixi ticker ----
  const tween = (ms: number, fn: (t: number) => void, ease: (t: number) => number = easeOutCubic) =>
    new Promise<void>((resolve) => {
      let elapsed = 0;
      const tick = (tk: Ticker) => {
        if (disposed()) return app.ticker?.remove(tick);
        elapsed += tk.deltaMS * timeScale;
        const t = Math.min(1, elapsed / ms);
        fn(ease(t));
        if (t >= 1) {
          app.ticker.remove(tick);
          resolve();
        }
      };
      app.ticker.add(tick);
    });
  const wait = (ms: number) => tween(ms, () => {});

  // camera shake and particles
  const particles: { g: Graphics; vx: number; vy: number; life: number; max: number }[] = [];
  app.ticker.add((tk) => {
    const dt = tk.deltaMS * timeScale;
    shake *= Math.pow(0.88, dt / 16);
    world.position.set(W / 2 + (Math.random() - 0.5) * shake, H / 2 + (Math.random() - 0.5) * shake);
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]!;
      p.life -= dt;
      p.g.x += (p.vx * dt) / 16;
      p.g.y += (p.vy * dt) / 16;
      p.vy += (0.25 * dt) / 16;
      p.g.alpha = Math.max(0, p.life / p.max);
      if (p.life <= 0) {
        p.g.destroy();
        particles.splice(i, 1);
      }
    }
  });
  const burst = (x: number, y: number, color: string, count: number, speed = 6) => {
    for (let i = 0; i < count; i++) {
      const g = new PIXI.Graphics().circle(0, 0, 1.5 + Math.random() * 2.5).fill(color);
      g.position.set(x, y);
      g.blendMode = 'add';
      world.addChild(g);
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random());
      particles.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, life: 500 + Math.random() * 400, max: 900 });
    }
  };

  // ---- the arena ----
  const floor = new PIXI.Graphics().ellipse(W / 2, floorY + 6, W * 0.42, 18).fill({ color: '#000000', alpha: 0.55 });
  world.addChild(floor);
  for (const tx of [W * 0.08, W * 0.92]) {
    const torch = new PIXI.Graphics().circle(0, 0, 26).fill({ color: '#f97316', alpha: 0.18 }).circle(0, 0, 6).fill({ color: '#fdba74', alpha: 0.9 });
    torch.position.set(tx, H * 0.42);
    torch.blendMode = 'add';
    world.addChild(torch);
    app.ticker.add(() => (torch.alpha = 0.75 + Math.random() * 0.25));
  }

  const sideX = (p: PlayerIndex) => (p === you ? W * 0.3 : W * 0.7);
  const dirOf = (p: PlayerIndex) => (p === you ? 1 : -1);
  const fighters = ([0, 1] as const).map((p) => {
    const c = drawFigure(PIXI, heroes[p]);
    c.scale.set(scale * dirOf(p), scale);
    c.position.set(sideX(p), floorY);
    world.addChild(c);
    return c;
  }) as [Container, Container];

  // HP bars and names (fixed to the screen, not the shaking world)
  const firstShown = Math.max(0, rounds.length - REPLAY_ROUNDS);
  const hp: [number, number] = firstShown > 0 ? [...rounds[firstShown - 1]!.hpAfter] : [HEROES[heroes[0]].maxHp, HEROES[heroes[1]].maxHp];
  const bars = ([0, 1] as const).map((p) => {
    const left = p === you;
    const bw = Math.min(W * 0.36, 320);
    const x = left ? 16 : W - 16 - bw;
    const label = new PIXI.Text({ text: `${names[p]} · ${HEROES[heroes[p]].name}`, style: { fontFamily: 'system-ui, sans-serif', fontSize: 14, fill: HERO_STYLE[heroes[p]].color, fontWeight: '600' } });
    label.position.set(left ? x : x + bw - label.width, 14);
    const bar = new PIXI.Graphics();
    app.stage.addChild(label, bar);
    const draw = () => {
      const frac = Math.max(0, hp[p] / HEROES[heroes[p]].maxHp);
      bar.clear().roundRect(x, 36, bw, 10, 5).fill('#0d0b12').stroke({ width: 1, color: '#3a3446' });
      const w = bw * frac;
      bar.roundRect(left ? x : x + bw - w, 36, w, 10, 5).fill(frac > 0.5 ? '#4ade80' : frac > 0.25 ? '#facc15' : '#f87171');
    };
    draw();
    return draw;
  });

  const banner = (text: string, color: string, size: number) => {
    const t = new PIXI.Text({ text, style: { fontFamily: displayFont, fontSize: size, fill: color, fontWeight: '800', stroke: { color: '#000000', width: 6 }, letterSpacing: 4 } });
    t.anchor.set(0.5);
    t.position.set(W / 2, H * 0.32);
    app.stage.addChild(t);
    return t;
  };
  const popup = (p: PlayerIndex, text: string, color: string) => {
    const t = new PIXI.Text({ text, style: { fontFamily: displayFont, fontSize: 34, fill: color, fontWeight: '800', stroke: { color: '#000000', width: 5 } } });
    t.anchor.set(0.5);
    t.position.set(fighters[p].x, floorY - 160 * scale - 10);
    world.addChild(t);
    void tween(900, (k) => {
      t.y = floorY - 160 * scale - 10 - k * 50;
      t.alpha = 1 - k * k;
    }).then(() => t.destroy());
  };

  await wait(400);

  // ---- replay ----
  const shown = rounds.slice(firstShown);
  for (const [i, r] of shown.entries()) {
    if (disposed()) return;
    const last = i === shown.length - 1;
    const ko = last && result.kind === 'knockout';
    const a = r.attacker;
    const d: PlayerIndex = a === 0 ? 1 : 0;
    const fa = fighters[a];
    const fd = fighters[d];
    const home = sideX(a);
    const contact = sideX(d) - dirOf(a) * 70 * scale;

    const label = banner(`Round ${r.round}`, '#ebe5d9', 22);
    label.y = H * 0.12;
    label.alpha = 0.8;
    if (ko) timeScale = 0.3;

    // wind up, then lunge
    await tween(160, (k) => (fa.x = home - dirOf(a) * 18 * k));
    await tween(200, (k) => (fa.x = home - dirOf(a) * 18 + (contact - home + dirOf(a) * 18) * k), easeInCubic);

    const impactX = (fa.x + fd.x) / 2;
    const impactY = floorY - 95 * scale;
    for (const p of [0, 1] as const) hp[p] = r.hpAfter[p];
    if (r.damageToDefender > 0) {
      burst(impactX, impactY, '#fca5a5', 18 + r.damageToDefender * 2, 7);
      flash(fd);
      shake = Math.min(26, 6 + r.damageToDefender * 1.6);
      await wait(ko ? 160 : 90); // hit-stop
      popup(d, `-${r.damageToDefender}`, '#f87171');
      bars[d]!();
      if (!ko) void tween(220, (k) => (fd.x = sideX(d) + dirOf(a) * 26 * Math.sin(k * Math.PI)));
    } else if (r.damageToAttacker > 0) {
      burst(impactX, impactY, '#93c5fd', 22, 6);
      shake = Math.min(20, 5 + r.damageToAttacker * 1.4);
      await wait(90);
      popup(d, 'Blocked!', '#ebe5d9');
      popup(a, `-${r.damageToAttacker}`, '#f87171');
      bars[a]!();
    } else {
      burst(impactX, impactY, '#fde68a', 10, 4);
      shake = 5;
      await wait(60);
      popup(d, 'Clash', '#ebe5d9');
    }
    if (r.healed.some((h) => h > 0)) r.healed.forEach((h, p) => h > 0 && (popup(p as PlayerIndex, `+${h}`, '#2dd4bf'), bars[p]!()));

    if (ko) {
      // slow-motion knockout: the loser falls, the camera pushes in on the winner
      const loser = r.hpAfter[0] === 0 ? 0 : 1;
      const winner: PlayerIndex = loser === 0 ? 1 : 0;
      const fl = fighters[loser];
      burst(fl.x, impactY, '#8b5cf6', 50, 9);
      const startX = fl.x;
      void tween(900, (k) => {
        fl.rotation = (loser === you ? -1 : 1) * 1.45 * k;
        fl.x = startX + dirOf(winner) * 40 * scale * k;
        fl.alpha = 1 - 0.45 * k;
      });
      const zoomTo = 1.35;
      const focusX = fighters[winner].x;
      await tween(1100, (k) => {
        world.scale.set(1 + (zoomTo - 1) * k);
        world.pivot.x = W / 2 + (focusX - W / 2) * k * 0.35;
        world.pivot.y = H / 2 + H * 0.12 * k; // keep the floor in frame
      });
      timeScale = 1;
      label.destroy();
      const text = banner('K.O.', '#ef4444', Math.min(110, W * 0.14));
      text.y = H * 0.16; // above the winner's head
      text.scale.set(2.2);
      await tween(260, (k) => text.scale.set(2.2 - 1.2 * k), easeOutBack);
      shake = 18;
      const glow = new PIXI.Graphics();
      for (let i = 0; i < 8; i++) glow.circle(0, 0, (30 + i * 9) * scale).fill({ color: '#8b5cf6', alpha: 0.035 });
      glow.position.set(fighters[winner].x, floorY - 80 * scale);
      glow.blendMode = 'add';
      world.addChildAt(glow, 1);
      await wait(1400);
      return;
    }

    await tween(300, (k) => (fa.x = contact + (home - contact) * k));
    label.destroy();
    await wait(180);
  }

  // ---- endings without a knockout ----
  if (result.kind === 'draw') {
    banner('DRAW', '#d9b45a', Math.min(96, W * 0.13));
  } else {
    const loser: PlayerIndex = result.winner === 0 ? 1 : 0;
    const words = { exit: 'FLED', timeout: 'TIME OUT', disconnect: 'DISCONNECTED', knockout: 'K.O.' } as const;
    const fl = fighters[loser];
    void tween(800, (k) => (fl.alpha = 1 - 0.75 * k));
    banner(words[result.kind], '#ef4444', Math.min(84, W * 0.11));
  }
  await wait(1600);
}

function drawFigure(PIXI: Pixi, heroId: HeroId): Container {
  const color = HERO_STYLE[heroId].color;
  const c = new PIXI.Container();
  const g = new PIXI.Graphics();
  for (const s of FIGURES[heroId]) {
    if (s.kind === 'circle') g.circle(s.x, s.y, s.r);
    else if (s.kind === 'rect') g.roundRect(s.x, s.y, s.w, s.h, s.r ?? 0);
    else g.poly(s.points);
    if (s.fill === 'body') g.fill(FIGURE_COLORS.body).stroke({ width: 1.2, color, alpha: 0.6 });
    else if (s.fill === 'metal') g.fill(FIGURE_COLORS.metal).stroke({ width: 1, color: FIGURE_COLORS.metalEdge });
    else if (s.fill === 'accent') g.fill({ color, alpha: 0.85 });
    else g.fill(color);
  }
  // soft aura: stacked faint ellipses instead of one hard-edged shape
  const glow = new PIXI.Graphics();
  for (let i = 0; i < 6; i++) glow.ellipse(50, 92, 22 + i * 7, 46 + i * 8).fill({ color, alpha: 0.025 });
  glow.blendMode = 'add';
  c.addChild(glow, g);
  c.pivot.set(50, 154); // feet on the floor
  return c;
}

/** Brief white flash on a hit. */
function flash(target: Container) {
  target.alpha = 0.35;
  setTimeout(() => (target.alpha = 1), 70);
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number) => t * t * t;
const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);
