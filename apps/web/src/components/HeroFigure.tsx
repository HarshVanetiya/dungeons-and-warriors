import type { HeroId } from '@dungeon-drill/game';
import { FIGURES, FIGURE_COLORS, type Fill } from '@/lib/figures';
import { HERO_STYLE } from '@/lib/heroes';

/** SVG silhouette of a hero, facing right unless `facing="left"`. */
export function HeroFigure({ heroId, facing = 'right', className }: { heroId: HeroId; facing?: 'left' | 'right'; className?: string }) {
  const color = HERO_STYLE[heroId].color;
  const fill = (f: Fill) =>
    f === 'body'
      ? { fill: FIGURE_COLORS.body, stroke: color, strokeOpacity: 0.55, strokeWidth: 1 }
      : f === 'metal'
        ? { fill: FIGURE_COLORS.metal, stroke: FIGURE_COLORS.metalEdge, strokeWidth: 1 }
        : f === 'accent'
          ? { fill: color, fillOpacity: 0.85 }
          : { fill: color, filter: 'url(#eyeGlow)' };
  return (
    <svg viewBox="-4 -4 108 168" className={className} role="img" aria-label={heroId}>
      <defs>
        <filter id="eyeGlow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g transform={facing === 'left' ? 'translate(100 0) scale(-1 1)' : undefined} strokeLinejoin="round">
        {FIGURES[heroId].map((s, i) =>
          s.kind === 'circle' ? (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} {...fill(s.fill)} />
          ) : s.kind === 'rect' ? (
            <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r ?? 0} {...fill(s.fill)} />
          ) : (
            <polygon key={i} points={s.points.join(' ')} {...fill(s.fill)} />
          ),
        )}
      </g>
    </svg>
  );
}
