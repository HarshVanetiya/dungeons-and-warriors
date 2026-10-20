'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { checkEmail } from '@/lib/forms';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bad = checkEmail(email);
    if (bad) return setError(bad);
    setBusy(true);
    const res = await api('/auth/forgot-password', { body: { email: email.trim() } });
    setBusy(false);
    if (!res.ok) return setError(errorMessage(res.error, res.body));
    router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a code to set a new one."
      footer={
        <Link href="/login" className="font-semibold text-shadow-bright hover:underline">
          Back to log in
        </Link>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Send code
        </Button>
      </form>
    </AuthCard>
  );
}
