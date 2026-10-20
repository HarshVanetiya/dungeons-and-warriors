'use client';

import { useEffect, useState } from 'react';

/**
 * The free Render server sleeps after 15 minutes without traffic and takes about a minute to wake
 * (DEPLOYMENT.md). Ping it on load and show a banner while it's waking up.
 */
export function ServerWake() {
  const [state, setState] = useState<'checking' | 'waking' | 'up'>('checking');

  useEffect(() => {
    let cancelled = false;
    const slow = setTimeout(() => !cancelled && setState((s) => (s === 'checking' ? 'waking' : s)), 2500);
    const ping = async () => {
      while (!cancelled) {
        try {
          const res = await fetch('/api/health', { cache: 'no-store' });
          if (res.ok) {
            if (!cancelled) setState('up');
            return;
          }
        } catch {
          // still asleep
        }
        if (!cancelled) setState('waking');
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    void ping();
    return () => {
      cancelled = true;
      clearTimeout(slow);
    };
  }, []);

  if (state !== 'waking') return null;
  return (
    <div role="status" className="border-b border-shadow/40 bg-shadow/15 px-4 py-2 text-center text-sm text-bone">
      <span className="mr-2 inline-block size-2 animate-pulse rounded-full bg-shadow-bright align-middle" />
      Waking up the server… this can take up to a minute on the free plan.
    </div>
  );
}
