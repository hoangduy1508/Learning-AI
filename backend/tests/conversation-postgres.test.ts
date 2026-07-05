import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PostgresConversationRepository,
  runConversationMigrations
} from "../src/conversations/postgres-repository.js";
import { conversationSchemaSql } from "../src/conversations/schema.js";

interface QueryCall {
  text: string;
  values?: readonly unknown[];
}

class FakeDatabase {
  readonly calls: QueryCall[] = [];

  constructor(private readonly queuedRows: object[][] = []) {}

  async query(text: string, values?: readonly unknown[]) {
    this.calls.push({ text, values });
    return {
      command: "",
      rowCount: this.queuedRows[0]?.length ?? 0,
      oid: 0,
      fields: [],
      rows: this.queuedRows.shift() ?? []
    };
  }
}

describe("PostgresConversationRepository", () => {
  it("runs idempotent conversation migrations", async () => {
    const database = new FakeDatabase();

    await runConversationMigrations(database);

    assert.equal(database.calls.length, 1);
    assert.equal(database.calls[0]?.text, conversationSchemaSql);
    assert.match(database.calls[0]?.text ?? "", /CREATE TABLE IF NOT EXISTS conversations/);
    assert.match(database.calls[0]?.text ?? "", /CREATE INDEX IF NOT EXISTS/);
  });

  it("creates a conversation and maps database rows to domain records", async () => {
    const createdAt = new Date("2026-06-28T10:00:00.000Z");
    const database = new FakeDatabase([
      [
        {
          id: "f1447b2b-15c1-465d-ae21-bcd06af72867",
          user_id: "user_1",
          title: "Demo",
          created_at: createdAt,
          updated_at: createdAt
        }
      ]
    ]);
    const repository = new PostgresConversationRepository(database);

    const conversation = await repository.createConversation("user_1", "Demo");

    assert.equal(conversation.id, "f1447b2b-15c1-465d-ae21-bcd06af72867");
    assert.equal(conversation.userId, "user_1");
    assert.equal(conversation.title, "Demo");
    assert.equal(conversation.createdAt, createdAt);
    assert.equal(database.calls[0]?.values?.[1], "user_1");
    assert.equal(database.calls[0]?.values?.[2], "Demo");
  });

  it("checks conversation ownership before returning a conversation", async () => {
    const database = new FakeDatabase([[]]);
    const repository = new PostgresConversationRepository(database);

    const conversation = await repository.findConversationForUser(
      "f1447b2b-15c1-465d-ae21-bcd06af72867",
      "user_2"
    );

    assert.equal(conversation, null);
    assert.deepEqual(database.calls[0]?.values, [
      "f1447b2b-15c1-465d-ae21-bcd06af72867",
      "user_2"
    ]);
  });

  it("adds messages with usage columns and maps them back to usage metadata", async () => {
    const createdAt = "2026-06-28T10:01:00.000Z";
    const database = new FakeDatabase([
      [
        {
          id: "b3e9b0d4-d0db-4f44-a978-76037ccdf574",
          conversation_id: "f1447b2b-15c1-465d-ae21-bcd06af72867",
          role: "assistant",
          content: "Hello",
          provider: "fake",
          model: "stub-model",
          input_tokens: 3,
          output_tokens: 5,
          thinking_tokens: null,
          total_tokens: 8,
          estimated_cost_usd_micros: 123,
          created_at: createdAt
        }
      ]
    ]);
    const repository = new PostgresConversationRepository(database);

    const message = await repository.addMessage({
      conversationId: "f1447b2b-15c1-465d-ae21-bcd06af72867",
      role: "assistant",
      content: "Hello",
      provider: "fake",
      model: "stub-model",
      usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 },
      estimatedCostUsdMicros: 123
    });

    assert.equal(message.conversationId, "f1447b2b-15c1-465d-ae21-bcd06af72867");
    assert.deepEqual(message.usage, { inputTokens: 3, outputTokens: 5, totalTokens: 8 });
    assert.equal(message.estimatedCostUsdMicros, 123);
    assert.deepEqual(database.calls[0]?.values?.slice(1), [
      "f1447b2b-15c1-465d-ae21-bcd06af72867",
      "assistant",
      "Hello",
      "fake",
      "stub-model",
      3,
      5,
      null,
      8,
      123
    ]);
  });

  it("summarizes token usage and estimated cost by user", async () => {
    const database = new FakeDatabase([
      [
        {
          request_count: "2",
          input_tokens: "100",
          output_tokens: "40",
          thinking_tokens: "10",
          total_tokens: "150",
          estimated_cost_usd_micros: "250"
        }
      ]
    ]);
    const repository = new PostgresConversationRepository(database);

    const summary = await repository.getUserCostSummary("user_1");

    assert.deepEqual(summary, {
      userId: "user_1",
      requestCount: 2,
      inputTokens: 100,
      outputTokens: 40,
      thinkingTokens: 10,
      totalTokens: 150,
      estimatedCostUsdMicros: 250
    });
    assert.deepEqual(database.calls[0]?.values, ["user_1"]);
    assert.match(database.calls[0]?.text, /SUM\(message\.estimated_cost_usd_micros\)/);
  });
});
