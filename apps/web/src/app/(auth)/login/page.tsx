'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { useAuth } from '@/components/AuthProvider';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage, type User } from '@/lib/api';

function Login() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/play';
  const { setUser } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await api<{ user: User }>('/auth/login', { body: { ...form, email: form.email.trim() } });
    setBusy(false);
    if (res.ok) {
      setUser(res.data.user);
      return router.push(next.startsWith('/') ? next : '/play');
    }
    if (res.error === 'emailNotVerified') return router.push(`/verify?email=${encodeURIComponent(form.email.trim().toLowerCase())}`);
    setError(errorMessage(res.error, res.body));
  }

  return (
    <AuthCard
      title="Welcome back"
      footer={
        <>
          New here?{' '}
          <Link href="/signup" className="font-semibold text-shadow-bright hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field id="email" label="Email" type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <div className="text-right text-sm">
          <Link href="/forgot-password" className="text-ash hover:text-bone hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Log in
        </Button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <Login />
    </Suspense>
  );
}
