import { defineConfig } from 'prisma/config';

// Migrations use the direct (non-pooled) Neon connection when it's set (DEPLOYMENT.md, A1).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '' },
});
