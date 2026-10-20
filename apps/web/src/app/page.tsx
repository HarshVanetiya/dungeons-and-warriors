'use client';

import { HERO_IDS } from '@dungeon-drill/game';
import { useAuth } from '@/components/AuthProvider';
import { HeroCard } from '@/components/HeroCard';
import { ButtonLink } from '@/components/ui';

export default function Home() {
  const { user } = useAuth();
  return (
    <div className="space-y-14 pt-6 sm:pt-12">
      <section className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-shadow-bright">1v1 dice duel</p>
        <h1 className="mt-3 font-display text-4xl font-extrabold tracking-wide sm:text-6xl">Roll. Strike. Outlast.</h1>
        <p className="mx-auto mt-4 max-w-xl text-ash sm:text-lg">
          Pick a hero and duel another player. Out-roll their guard to wound them, but a stronger defense turns your blow back on you.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {user ? (
            <ButtonLink href="/play" className="px-8 text-lg">
              Enter the dungeon
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signup" className="px-8 text-lg">
                Create account
              </ButtonLink>
              <ButtonLink href="/login" variant="secondary" className="px-8 text-lg">
                Log in
              </ButtonLink>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="heroes">
        <h2 id="heroes" className="mb-5 text-center font-display text-2xl font-extrabold tracking-wider">
          Five heroes, perfectly matched
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
          {HERO_IDS.map((id) => (
            <HeroCard key={id} heroId={id} />
          ))}
        </div>
        <p className="mt-4 text-center text-sm text-ash">Every matchup is within 2.5% of an even 50/50, checked by simulation.</p>
      </section>
    </div>
  );
}
