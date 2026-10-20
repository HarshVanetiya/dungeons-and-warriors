'use client';

import { useEffect, useState } from 'react';

/** Whole seconds until `endsAt` (server clock, epoch ms), or null when there's no deadline. */
export function useSecondsLeft(endsAt: number | null, clockOffset: number): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (endsAt === null) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [endsAt]);
  if (endsAt === null) return null;
  return Math.max(0, Math.ceil((endsAt - (now - clockOffset)) / 1000));
}

/** Seconds since `start` (local clock), ticking once a second. */
export function useElapsed(start: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (start === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [start]);
  return start === null ? 0 : Math.max(0, Math.floor((now - start) / 1000));
}
