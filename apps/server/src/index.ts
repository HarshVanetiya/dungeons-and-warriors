import { createServer } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';
import { createEmailSender } from './email.js';

const config = loadConfig();
const db = createDb(config.DATABASE_URL);
const { httpServer, io } = createServer({ config, db, email: createEmailSender(config) });

httpServer.listen(config.PORT, () => {
  console.log(`Dungeon Drill server listening on port ${config.PORT} (email mode: ${config.EMAIL_MODE})`);
});

// Render sends SIGTERM before a redeploy
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    io.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  });
}
