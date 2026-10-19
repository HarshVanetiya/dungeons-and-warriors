import { z } from 'zod';

// Environment variables, documented in DEPLOYMENT.md (B3).
const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SOCKET_TOKEN_SECRET: z.string().min(32, 'SOCKET_TOKEN_SECRET must be at least 32 characters'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  EMAIL_MODE: z.enum(['resend', 'log']).default('log'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Dungeon Drill <onboarding@resend.dev>'),
  /** How many proxies sit in front of the server (Render adds 1). Used to read the real client IP for rate limits. */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(1),
});

export type Config = z.infer<typeof Env>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Env.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment variables:\n${problems}`);
  }
  if (parsed.data.EMAIL_MODE === 'resend' && !parsed.data.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is required when EMAIL_MODE=resend');
  }
  return parsed.data;
}

/** Game timers in milliseconds (GAME_RULES.md section 5). Tests shorten them. */
export interface Timings {
  turnMs: number;
  drawAnswerMs: number;
  reconnectMs: number;
}

export const GAME_TIMINGS: Timings = { turnMs: 30_000, drawAnswerMs: 30_000, reconnectMs: 30_000 };
