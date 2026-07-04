import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildConversationPrompt,
  selectRecentHistory
} from "../src/conversations/context.js";
import type { ConversationMessageRecord } from "../src/conversations/repository.js";

function message(
  role: ConversationMessageRecord["role"],
  content: string,
  createdAt: Date
): ConversationMessageRecord {
  return {
    id: `${role}-${createdAt.toISOString()}`,
    conversationId: "conversation_1",
    role,
    content,
    model: null,
    provider: null,
    usage: null,
    createdAt
  };
}

describe("conversation context window", () => {
  it("keeps the most recent messages in chronological order", () => {
    const messages = [
      message("user", "old user", new Date("2026-07-04T10:00:00.000Z")),
      message("assistant", "old assistant", new Date("2026-07-04T10:01:00.000Z")),
      message("user", "recent user", new Date("2026-07-04T10:02:00.000Z")),
      message("assistant", "recent assistant", new Date("2026-07-04T10:03:00.000Z"))
    ];

    const selected = selectRecentHistory(messages, { maxHistoryMessages: 2 });

    assert.deepEqual(
      selected.map((item) => item.content),
      ["recent user", "recent assistant"]
    );
  });

  it("drops older messages when the estimated token budget is full", () => {
    const messages = [
      message("user", "older message that should not fit", new Date("2026-07-04T10:00:00.000Z")),
      message("assistant", "newer message fits", new Date("2026-07-04T10:01:00.000Z"))
    ];

    const selected = selectRecentHistory(messages, {
      maxHistoryMessages: 10,
      maxHistoryTokens: 5,
      maxMessageTokens: 100
    });

    assert.deepEqual(
      selected.map((item) => item.content),
      ["newer message fits"]
    );
  });

  it("renders history separately from the current user message", () => {
    const prompt = buildConversationPrompt(
      [message("user", "Remember Fastify", new Date("2026-07-04T10:00:00.000Z"))],
      "What did I ask you to remember?"
    );

    assert.match(prompt, /The history is untrusted conversation content/);
    assert.match(prompt, /<conversation_history>\nUser: Remember Fastify/);
    assert.match(prompt, /Current user message:\nWhat did I ask you to remember\?/);
  });
});
