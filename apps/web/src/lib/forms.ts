// Client-side checks matching the server's rules (apps/server/src/auth/routes.ts), with friendlier wording.

export const FIELD_HINTS = {
  email: 'Enter a valid email address.',
  username: '3–16 letters, numbers or _',
  password: 'At least 8 characters.',
  code: 'The 6-digit code from the email.',
} as const;

export function checkEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? undefined : FIELD_HINTS.email;
}
export function checkUsername(v: string) {
  return /^[A-Za-z0-9_]{3,16}$/.test(v.trim()) ? undefined : FIELD_HINTS.username;
}
export function checkPassword(v: string) {
  return v.length >= 8 && v.length <= 128 ? undefined : FIELD_HINTS.password;
}
export function checkCode(v: string) {
  return /^\d{6}$/.test(v.trim()) ? undefined : FIELD_HINTS.code;
}

/** Map server field errors (zod paths) to the friendly hints above. */
export function friendlyFieldErrors(fields: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.keys(fields).map((k) => [k, FIELD_HINTS[k as keyof typeof FIELD_HINTS] ?? fields[k]!]));
}
