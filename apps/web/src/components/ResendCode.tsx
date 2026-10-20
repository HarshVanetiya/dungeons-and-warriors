'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** "Resend code" link with the 60-second cooldown from GAME_RULES.md section 8. */
export function ResendCode({ email, purpose }: { email: string; purpose: 'verify' | 'reset' }) {
  const [wait, setWait] = useState(60);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  return (
    <p className="text-sm text-ash">
      Didn&apos;t get it? Check spam, or{' '}
      {wait > 0 ? (
        <span>resend in {wait}s</span>
      ) : (
        <button
          type="button"
          className="font-semibold text-shadow-bright underline-offset-4 hover:underline"
          onClick={async () => {
            await api('/auth/resend-code', { body: { email, purpose } });
            setSent(true);
            setWait(60);
          }}
        >
          resend the code
        </button>
      )}
      .{sent ? <span className="ml-1 text-heal">New code sent.</span> : null}
    </p>
  );
}
