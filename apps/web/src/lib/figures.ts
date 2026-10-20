// Placeholder hero silhouettes until the AI-generated art exists (GAME_RULES.md section 9).
// Shapes are in a 100 x 160 box, facing right. The SVG figure and the PixiJS fight scene both draw them.

import type { HeroId } from '@dungeon-drill/game';

export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number; fill: Fill }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; r?: number; fill: Fill }
  | { kind: 'poly'; points: number[]; fill: Fill };

/** body: dark silhouette with a rim light; metal: weapons and armour; accent: the hero's colour; eye: glowing eyes. */
export type Fill = 'body' | 'metal' | 'accent' | 'eye';

const backLeg: Shape = { kind: 'poly', points: [41, 86, 53, 86, 48, 126, 41, 154, 28, 154, 35, 124], fill: 'body' };
const frontLeg: Shape = { kind: 'poly', points: [52, 86, 65, 86, 69, 122, 80, 154, 67, 154, 55, 126], fill: 'body' };
const backArm: Shape = { kind: 'poly', points: [46, 40, 38, 42, 28, 68, 36, 73], fill: 'body' };
const frontArm: Shape = { kind: 'poly', points: [58, 40, 67, 42, 83, 62, 75, 69], fill: 'body' };
const torso = (w = 0): Shape => ({ kind: 'poly', points: [44 - w, 37, 62 + w, 37, 66 + w, 86, 40 - w, 86], fill: 'body' });
const head: Shape = { kind: 'circle', x: 53, y: 26, r: 11, fill: 'body' };
const eye: Shape = { kind: 'circle', x: 59, y: 25, r: 1.8, fill: 'eye' };
const helmet: Shape = { kind: 'rect', x: 42, y: 14, w: 22, h: 22, r: 5, fill: 'metal' };
const visor: Shape = { kind: 'rect', x: 55, y: 23, w: 9, h: 3, fill: 'eye' };

export const FIGURES: Record<HeroId, Shape[]> = {
  berserker: [
    { kind: 'poly', points: [32, 70, 35, 71, 24, 44, 21, 45], fill: 'metal' },
    { kind: 'poly', points: [18, 40, 28, 36, 30, 50, 20, 52], fill: 'metal' },
    backLeg, backArm, torso(2), frontLeg, head, eye,
    { kind: 'poly', points: [36, 36, 70, 36, 74, 47, 32, 47], fill: 'accent' },
    frontArm,
    { kind: 'poly', points: [76, 66, 79, 64, 92, 30, 89, 29], fill: 'metal' },
    { kind: 'poly', points: [86, 26, 99, 19, 100, 39, 90, 36], fill: 'metal' },
  ],
  rogue: [
    { kind: 'poly', points: [32, 70, 21, 81, 23, 83, 34, 72], fill: 'metal' },
    backLeg, backArm, torso(-2), frontLeg, head,
    { kind: 'poly', points: [39, 31, 53, 7, 67, 31, 61, 37, 45, 37], fill: 'body' },
    eye,
    { kind: 'poly', points: [44, 38, 62, 38, 60, 44, 46, 44], fill: 'accent' },
    frontArm,
    { kind: 'poly', points: [78, 64, 94, 57, 95, 60, 80, 68], fill: 'metal' },
  ],
  knight: [
    { kind: 'rect', x: 20, y: 46, w: 17, h: 34, r: 4, fill: 'metal' },
    backLeg, backArm, torso(), frontLeg, head, helmet, visor,
    { kind: 'poly', points: [50, 14, 54, 4, 60, 6, 56, 15], fill: 'accent' },
    frontArm,
    { kind: 'rect', x: 72, y: 58, w: 14, h: 4, fill: 'metal' },
    { kind: 'poly', points: [77, 60, 81, 60, 99, 18, 96, 16], fill: 'metal' },
  ],
  monk: [
    backLeg, backArm,
    { kind: 'circle', x: 31, y: 71, r: 5, fill: 'body' },
    torso(), frontLeg, head,
    { kind: 'circle', x: 51, y: 13, r: 5, fill: 'body' },
    eye,
    { kind: 'rect', x: 40, y: 76, w: 26, h: 6, fill: 'accent' },
    frontArm,
    { kind: 'circle', x: 81, y: 64, r: 5.5, fill: 'body' },
    { kind: 'rect', x: 72, y: 56, w: 8, h: 4, fill: 'accent' },
  ],
  guardian: [
    { kind: 'poly', points: [29, 74, 33, 74, 30, 18, 26, 18], fill: 'metal' },
    { kind: 'rect', x: 16, y: 8, w: 24, h: 15, r: 3, fill: 'metal' },
    backLeg, backArm, torso(5), frontLeg, head, helmet, visor,
    { kind: 'circle', x: 41, y: 42, r: 9, fill: 'metal' },
    frontArm,
    { kind: 'circle', x: 65, y: 42, r: 9, fill: 'metal' },
    { kind: 'rect', x: 66, y: 38, w: 24, h: 74, r: 5, fill: 'metal' },
    { kind: 'rect', x: 74, y: 46, w: 8, h: 58, r: 2, fill: 'accent' },
  ],
};

export const FIGURE_COLORS = {
  body: '#0e0c14',
  metal: '#2a2733',
  metalEdge: '#5b5668',
} as const;
