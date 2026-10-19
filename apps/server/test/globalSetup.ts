import { execSync } from 'node:child_process';

export default function setup(): void {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    console.warn('\n  TEST_DATABASE_URL is not set: database tests will be skipped (see apps/server/README.md)\n');
    return;
  }
  // bring the test database up to the latest schema
  execSync('npx prisma migrate deploy', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
}
