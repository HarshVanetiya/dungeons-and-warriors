// Calls to the game server through this site's /api rewrite.

export interface User {
  id: string;
  email: string;
  username: string;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
}

export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string; body: Record<string, unknown> };

export async function api<T>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
      headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, error: 'serverUnavailable', body: {} };
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, data: body as T };
  // a sleeping or restarting server shows up as a 5xx from the rewrite
  const error = typeof body.error === 'string' ? body.error : res.status >= 500 ? 'serverUnavailable' : 'unknown';
  return { ok: false, status: res.status, error, body };
}

const MESSAGES: Record<string, string> = {
  serverUnavailable: "Can't reach the server. It may be waking up; try again in a moment.",
  invalidInput: 'Please check the highlighted fields.',
  emailTaken: 'An account with this email already exists. Try logging in.',
  usernameTaken: 'That username is taken.',
  invalidCredentials: 'Wrong email or password.',
  emailNotVerified: 'Please verify your email first. We sent you a new code.',
  locked: 'Too many wrong passwords. Try again later.',
  rateLimited: 'Too many attempts from your network. Please wait a few minutes and try again.',
  invalidCode: "That code isn't right.",
  codeExpired: 'That code has expired. Request a new one.',
  tooManyAttempts: 'Too many wrong codes. Request a new one.',
  notLoggedIn: 'Please log in.',
  // game errors
  notYourTurn: "It's not your turn.",
  drawOfferPending: 'Waiting for the answer to the draw offer.',
  cannotOfferDraw: "You can't offer a draw right now.",
  powerupNotHeld: "You don't have that powerup.",
  wrongTimingForPowerup: "That powerup can't be used on this turn.",
  powerupAlreadyActive: 'That powerup is already active.',
  matchFinished: 'The match is over.',
  notInMatch: "You're not in a match.",
  alreadyInMatch: "You're already in a match.",
  disconnected: 'Connection lost. Reconnecting…',
};

export function errorMessage(code: string, body: Record<string, unknown> = {}): string {
  if (code === 'locked' && typeof body.retryAfterSeconds === 'number') {
    return `Too many wrong passwords. Try again in ${Math.ceil(body.retryAfterSeconds / 60)} minutes.`;
  }
  return MESSAGES[code] ?? 'Something went wrong. Please try again.';
}

/** Field errors from a 400 invalidInput response, keyed by field name. */
export function fieldErrors(body: Record<string, unknown>): Record<string, string> {
  const details = Array.isArray(body.details) ? (body.details as { path: string; message: string }[]) : [];
  return Object.fromEntries(details.map((d) => [d.path, d.message]));
}
