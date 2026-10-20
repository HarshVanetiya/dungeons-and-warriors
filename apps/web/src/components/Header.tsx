'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

export function Header() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const nav = [
    { href: '/play', label: 'Play' },
    { href: '/leaderboard', label: 'Leaderboard' },
  ];
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-4 sm:px-6">
      <Link href="/" className="shrink-0 whitespace-nowrap font-display text-base font-extrabold tracking-[0.1em] text-bone sm:text-xl sm:tracking-[0.12em]">
        DUNGEON <span className="text-shadow-bright">DRILL</span>
      </Link>
      <nav className="flex items-center whitespace-nowrap text-sm sm:gap-2">
        {nav.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`rounded-md px-2 py-2 font-medium transition sm:px-3 ${pathname.startsWith(n.href) ? 'bg-stone-800 text-bone' : 'text-ash hover:text-bone'}`}
          >
            {n.label}
          </Link>
        ))}
        {user ? (
          <button
            type="button"
            onClick={async () => {
              await logout();
              // full reload: closes the game connection and skips the play page's login redirect
              window.location.assign('/');
            }}
            className="rounded-md px-2 py-2 font-medium text-ash hover:text-bone sm:px-3"
            title={`Logged in as ${user.username}`}
          >
            Log out
          </button>
        ) : user === null ? (
          <Link href="/login" className="rounded-md px-2 py-2 font-medium text-ash hover:text-bone sm:px-3">
            Log in
          </Link>
        ) : null}
      </nav>
    </header>
  );
}
