'use client';

import Link from 'next/link';
import type { ButtonHTMLAttributes, InputHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-shadow to-[#6d3fd6] text-white shadow-[0_0_20px_rgb(139_92_246/0.35)] hover:from-shadow-bright hover:to-shadow disabled:from-stone-700 disabled:to-stone-700 disabled:text-ash disabled:shadow-none',
  secondary: 'border border-stone-600 bg-stone-800 text-bone hover:border-ash hover:bg-stone-700 disabled:text-ash',
  danger: 'border border-blood/60 bg-blood/15 text-red-200 hover:bg-blood/30 disabled:opacity-50',
  ghost: 'text-ash hover:text-bone hover:bg-stone-800 disabled:opacity-50',
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 font-semibold tracking-wide transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function ButtonLink({ href, variant = 'primary', className = '', children }: { href: string; variant?: Variant; className?: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 font-semibold tracking-wide transition ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Field({ label, error, hint, id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | undefined; hint?: string; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-bone">
        {label}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={`block w-full rounded-lg border bg-stone-950 px-3.5 py-2.5 text-bone placeholder:text-stone-600 focus:border-shadow focus:outline-none ${error ? 'border-blood' : 'border-stone-600'}`}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ash">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Alert({ tone = 'error', children }: { tone?: 'error' | 'info' | 'success'; children: React.ReactNode }) {
  const styles = {
    error: 'border-blood/50 bg-blood/10 text-red-200',
    info: 'border-shadow/40 bg-shadow/10 text-bone',
    success: 'border-heal/40 bg-heal/10 text-teal-100',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}
