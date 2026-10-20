import { defineConfig } from 'prisma/config';

// Prisma 7 doesn't read .env by itself; load it for local development (Render sets real env vars).
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file: use the environment as is
}

// Migrations use the direct (non-pooled) Neon connection when it's set (DEPLOYMENT.md, A1).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
});
