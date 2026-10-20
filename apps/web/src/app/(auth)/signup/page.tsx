'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage, fieldErrors } from '@/lib/api';
import { checkEmail, checkPassword, checkUsername, friendlyFieldErrors, FIELD_HINTS } from '@/lib/forms';

export default function SignUpPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', username: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = { email: checkEmail(form.email), username: checkUsername(form.username), password: checkPassword(form.password) };
    setErrors(local);
    setError('');
    if (Object.values(local).some(Boolean)) return;
    setBusy(true);
    const res = await api<{ email: string }>('/auth/signup', { body: form });
    setBusy(false);
    if (res.ok) return router.push(`/verify?email=${encodeURIComponent(res.data.email)}`);
    if (res.error === 'invalidInput') setErrors(friendlyFieldErrors(fieldErrors(res.body)));
    else if (res.error === 'usernameTaken') setErrors({ username: errorMessage(res.error) });
    else setError(errorMessage(res.error, res.body));
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <AuthCard
      title="Create your account"
      subtitle="We'll email you a 6-digit code to confirm it's you."
      footer={
        <>
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-shadow-bright hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        {error ? <Alert>{error}</Alert> : null}
        <Field id="email" label="Email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
        <Field
          id="username"
          label="Username"
          autoComplete="username"
          value={form.username}
          onChange={set('username')}
          error={errors.username}
          hint={`Shown on the leaderboard. ${FIELD_HINTS.username}`}
        />
        <Field
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint={FIELD_HINTS.password}
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Create account
        </Button>
      </form>
    </AuthCard>
  );
}
