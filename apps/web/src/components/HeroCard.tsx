import { HEROES, type HeroId } from '@dungeon-drill/game';
import { HERO_STYLE } from '@/lib/heroes';
import { HeroFigure } from './HeroFigure';

// Bars are scaled against the largest value in the roster.
const MAX = { attackScore: 14, defenseScore: 11, maxHp: 85 };

export function HeroCard({ heroId, selected, onSelect }: { heroId: HeroId; selected?: boolean; onSelect?: () => void }) {
  const hero = HEROES[heroId];
  const style = HERO_STYLE[heroId];
  const Tag = onSelect ? 'button' : 'div';
  return (
    <Tag
      {...(onSelect ? { type: 'button' as const, onClick: onSelect, 'aria-pressed': selected } : {})}
      className={`panel group relative flex w-full flex-col overflow-hidden p-4 text-left transition ${onSelect ? 'cursor-pointer hover:-translate-y-0.5 hover:border-stone-600' : ''} ${selected ? 'shadow-glow !border-shadow' : ''}`}
      style={{ '--hero': style.color } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-60 transition group-hover:opacity-90"
        style={{ background: `radial-gradient(ellipse 60% 70% at 50% 35%, ${style.color}33, transparent 70%)` }}
      />
      <HeroFigure heroId={heroId} className="relative mx-auto h-36 w-auto drop-shadow-[0_8px_12px_rgb(0_0_0/0.8)]" />
      <h3 className="relative mt-3 font-display text-lg font-extrabold tracking-wider" style={{ color: style.color }}>
        {hero.name}
      </h3>
      <p className="relative text-sm font-medium text-bone">{style.tagline}</p>
      <p className="relative mt-1 min-h-10 text-xs leading-relaxed text-ash">{style.style}</p>
      <dl className="relative mt-3 space-y-1.5 text-xs">
        <Stat label="Attack" value={hero.attackScore} max={MAX.attackScore} color="var(--color-ember)" />
        <Stat label="Defense" value={hero.defenseScore} max={MAX.defenseScore} color="#58a6e8" />
        <Stat label="HP" value={hero.maxHp} max={MAX.maxHp} color="var(--color-heal)" />
      </dl>
    </Tag>
  );
}

function Stat({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="grid grid-cols-[3.75rem_1fr_1.75rem] items-center gap-2">
      <dt className="text-ash">{label}</dt>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone-950">
        <div className="h-full rounded-full" style={{ width: `${(100 * value) / max}%`, background: color }} />
      </div>
      <dd className="text-right font-semibold tabular-nums text-bone">{value}</dd>
    </div>
  );
}
