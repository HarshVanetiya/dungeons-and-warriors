import { defineConfig } from 'vitest/config';

// Server tests need a throwaway Postgres database in TEST_DATABASE_URL (see apps/server/README.md).
export default defineConfig({
  test: {
    globalSetup: ['./test/globalSetup.ts'],
    fileParallelism: false, // the test files share one database
    testTimeout: 15_000,
  },
});
