import { Pool } from "pg";

import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import {
  PostgresConversationRepository,
  runConversationMigrations
} from "./conversations/postgres-repository.js";
import { createLlmProvider } from "./providers/index.js";

const config = loadConfig();
const provider = createLlmProvider(config);
const pool = config.DATABASE_URL
  ? new Pool({
      connectionString: config.DATABASE_URL,
      ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false
    })
  : null;

if (pool && config.DATABASE_RUN_MIGRATIONS) {
  await runConversationMigrations(pool);
}

const app = buildApp(
  provider,
  config,
  pool ? { conversationRepository: new PostgresConversationRepository(pool) } : undefined
);

if (pool) {
  app.addHook("onClose", async () => {
    await pool.end();
  });
}

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  console.log(`AI Learning API listening on http://${config.HOST}:${config.PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
