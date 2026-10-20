'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AuthCard } from '@/components/AuthCard';
import { useAuth } from '@/components/AuthProvider';
import { ResendCode } from '@/components/ResendCode';
import { Alert, Button, Field, Spinner } from '@/components/ui';
import { api, errorMessage, type User } from '@/lib/api';
import { checkCode, checkPassword, FIELD_HINTS } from '@/lib/forms';

function Reset() {
  const email = useSearchParams().get('email') ?? '';
  const router = useRouter();
  const { setUser } = useAuth();
  const [form, setForm] = useState({ code: '', newPassword: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local = {
      code: checkCode(form.code),
      newPassword: checkPassword(form.newPassword),
      confirm: form.confirm === form.newPassword ? undefined : "Passwords don't match.",
    };
    setErrors(local);
    setError('');
    if (Object.values(local).some(Boolean)) return;
    setBusy(true);
    const res = await api<{ user: User }>('/auth/reset-password', { body: { email, code: form.code.trim(), newPassword: form.newPassword } });
    setBusy(false);
    if (!res.ok) return setError(errorMessage(res.error, res.body));
    setUser(res.data.user);
    router.push('/play');
  }

  return (
    <AuthCard
      title="Set a new password"
      subtitle={
        <>
          If an account exists for <span className="font-semibold text-bone">{email}</span>, we sent it a 6-digit code. Setting a new password logs you
          out everywhere else.
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
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
          error={errors.code}
          className="tracking-[0.5em]"
        />
        <Field
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
          error={errors.newPassword}
          hint={FIELD_HINTS.password}
        />
        <Field
          id="confirm"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={(e) => setForm({ ...form, confirm: e.target.value })}
          error={errors.confirm}
        />
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? <Spinner /> : null} Save and log in
        </Button>
        <ResendCode email={email} purpose="reset" />
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Reset />
    </Suspense>
  );
}
