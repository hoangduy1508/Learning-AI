import { Pool } from "pg";

import { buildApp } from "../app.js";
import { loadConfig } from "../config.js";
import {
  PostgresConversationRepository,
  runConversationMigrations
} from "../conversations/postgres-repository.js";
import { FakeLlmProvider } from "../providers/fake.js";

const config = loadConfig({
  ...process.env,
  LLM_PROVIDER: "fake"
});

if (!config.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for conversation DB smoke test");
}

const pool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false
});

try {
  await runConversationMigrations(pool);

  const repository = new PostgresConversationRepository(pool);
  const app = buildApp(new FakeLlmProvider(), config, { conversationRepository: repository });

  try {
    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "smoke-user",
        message: "Remember this database smoke test"
      }
    });

    if (firstResponse.statusCode !== 200) {
      throw new Error(`First chat request failed: ${firstResponse.statusCode} ${firstResponse.body}`);
    }

    const firstBody = firstResponse.json<{
      conversation_id: string;
      assistant_message_id: string;
    }>();

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "smoke-user",
        conversationId: firstBody.conversation_id,
        message: "Append another persisted message"
      }
    });

    if (secondResponse.statusCode !== 200) {
      throw new Error(`Second chat request failed: ${secondResponse.statusCode} ${secondResponse.body}`);
    }

    const messages = await repository.listMessages(firstBody.conversation_id);
    if (messages.length !== 4) {
      throw new Error(`Expected 4 persisted messages, received ${messages.length}`);
    }

    const wrongOwnerResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "wrong-user",
        conversationId: firstBody.conversation_id,
        message: "This must not append"
      }
    });

    if (wrongOwnerResponse.statusCode !== 404) {
      throw new Error(`Expected wrong-owner request to return 404, got ${wrongOwnerResponse.statusCode}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          conversationId: firstBody.conversation_id,
          persistedMessages: messages.length,
          roles: messages.map((message) => message.role)
        },
        null,
        2
      )
    );
  } finally {
    await app.close();
  }
} finally {
  await pool.end();
}
