'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { useAuth } from '@/components/AuthProvider';
import { ResendCode } from '@/components/ResendCode';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage, type User } from '@/lib/api';
import { checkCode } from '@/lib/forms';

function Verify() {
  const email = useSearchParams().get('email') ?? '';
  const router = useRouter();
  const { setUser } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = checkCode(code);
    if (bad) return setError(bad);
    setBusy(true);
    const res = await api<{ user: User }>('/auth/verify-email', { body: { email, code: code.trim() } });
    setBusy(false);
    if (!res.ok) return setError(errorMessage(res.error, res.body));
    setUser(res.data.user);
    router.push('/play');
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={
        <>
          We sent a 6-digit code to <span className="font-semibold text-bone">{email || 'your email'}</span>. It expires in 10 minutes.
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field
          id="code"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          className="tracking-[0.5em]"
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Verify and play
        </Button>
        <ResendCode email={email} purpose="verify" />
      </form>
    </AuthCard>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Verify />
    </Suspense>
  );
}
