import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { InMemoryConversationRepository } from "../src/conversations/repository.js";
import { LlmProviderError, type LlmProvider } from "../src/providers/types.js";
import { parseStreamEvents } from "../src/streaming/events.js";

const stubProvider: LlmProvider = {
  async generate(message) {
    return {
      text: `Answer to: ${message}`,
      provider: "fake",
      model: "stub-model",
      usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
    };
  },

  async *stream(message) {
    yield { type: "metadata" as const, provider: "fake" as const, model: "stub-model" };
    yield { type: "delta" as const, text: "Stream " };
    yield { type: "delta" as const, text: `answer: ${message}` };
    yield {
      type: "usage" as const,
      usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 }
    };
  }
};

const failingProvider: LlmProvider = {
  async generate() {
    throw new LlmProviderError("Provider unavailable");
  },

  async *stream() {
    throw new LlmProviderError("Provider unavailable");
  }
};

function createFlakyProvider(failuresBeforeSuccess: number): LlmProvider & { calls: number } {
  return {
    calls: 0,
    async generate(message) {
      this.calls += 1;
      if (this.calls <= failuresBeforeSuccess) {
        throw new LlmProviderError("Temporary provider failure", { retryable: true });
      }
      return {
        text: `Recovered answer to: ${message}`,
        provider: "fake",
        model: "flaky-model",
        usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
      };
    },

    async *stream(message) {
      yield { type: "metadata" as const, provider: "fake" as const, model: "flaky-model" };
      yield { type: "delta" as const, text: `Stream answer: ${message}` };
      yield {
        type: "usage" as const,
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 }
      };
    }
  };
}

const apps: ReturnType<typeof buildApp>[] = [];

function createApp(provider: LlmProvider) {
  const app = buildApp(provider);
  apps.push(app);
  return app;
}

function createRecordingProvider(): LlmProvider & { messages: string[] } {
  const messages: string[] = [];
  return {
    messages,
    async generate(message) {
      messages.push(message);
      return {
        text: `Answer to: ${message}`,
        provider: "fake",
        model: "stub-model",
        usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
      };
    },

    async *stream(message) {
      yield { type: "metadata" as const, provider: "fake" as const, model: "stub-model" };
      yield { type: "delta" as const, text: `Stream answer: ${message}` };
      yield {
        type: "usage" as const,
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 }
      };
    }
  };
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("AI Learning API", () => {
  it("returns health status", async () => {
    const response = await createApp(stubProvider).inject({ method: "GET", url: "/health" });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { status: "ok" });
  });

  it("returns an answer and usage", async () => {
    const response = await createApp(stubProvider).inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "What is a token?" }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.latency_ms, "number");
    assert.deepEqual(
      {
        answer: body.answer,
        provider: body.provider,
        model: body.model,
        usage: body.usage
      },
      {
        answer: "Answer to: What is a token?",
        provider: "fake",
        model: "stub-model",
        usage: { input_tokens: 3, output_tokens: 5, thinking_tokens: 0, total_tokens: 8 }
      }
    );
  });

  it("persists a new conversation when a repository is configured", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const response = await buildApp(stubProvider, undefined, { conversationRepository }).inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "Persist this" }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(typeof body.conversation_id, "string");
    assert.equal(typeof body.assistant_message_id, "string");

    const messages = await conversationRepository.listMessages(body.conversation_id);
    assert.deepEqual(
      messages.map((message) => ({
        role: message.role,
        content: message.content,
        model: message.model,
        provider: message.provider
      })),
      [
        { role: "user", content: "Persist this", model: null, provider: null },
        {
          role: "assistant",
          content: "Answer to: Persist this",
          model: "stub-model",
          provider: "fake"
        }
      ]
    );
  });

  it("appends to an owned conversation", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const conversation = await conversationRepository.createConversation("user_1");

    const response = await buildApp(stubProvider, undefined, { conversationRepository }).inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "user_1",
        conversationId: conversation.id,
        message: "Continue this"
      }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().conversation_id, conversation.id);

    const messages = await conversationRepository.listMessages(conversation.id);
    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.content, "Continue this");
    assert.equal(messages[1]?.content, "Answer to: Continue this");
  });

  it("sends previous conversation messages as bounded provider context", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const provider = createRecordingProvider();
    const app = buildApp(provider, undefined, { conversationRepository });
    apps.push(app);
    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "My project uses Fastify" }
    });
    const conversationId = firstResponse.json().conversation_id;

    const secondResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "user_1",
        conversationId,
        message: "What framework did I mention?"
      }
    });

    assert.equal(secondResponse.statusCode, 200);
    assert.match(provider.messages[1] ?? "", /<conversation_history>/);
    assert.match(provider.messages[1] ?? "", /User: My project uses Fastify/);
    assert.match(provider.messages[1] ?? "", /Assistant: Answer to: My project uses Fastify/);
    assert.match(provider.messages[1] ?? "", /Current user message:\nWhat framework did I mention\?/);
  });

  it("rejects a conversation owned by another user", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const conversation = await conversationRepository.createConversation("user_1");

    const response = await buildApp(stubProvider, undefined, { conversationRepository }).inject({
      method: "POST",
      url: "/api/chat",
      payload: {
        userId: "user_2",
        conversationId: conversation.id,
        message: "Can I see it?"
      }
    });

    assert.equal(response.statusCode, 404);
    assert.deepEqual(response.json(), { detail: "Conversation not found" });
    assert.deepEqual(await conversationRepository.listMessages(conversation.id), []);
  });

  it("rejects an empty message", async () => {
    const response = await createApp(stubProvider).inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "" }
    });

    assert.equal(response.statusCode, 422);
  });

  it("maps provider errors to bad gateway", async () => {
    const response = await createApp(failingProvider).inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Hello" }
    });

    assert.equal(response.statusCode, 502);
    assert.deepEqual(response.json(), { detail: "Provider unavailable" });
  });

  it("retries retryable chat provider failures before returning an answer", async () => {
    const provider = createFlakyProvider(2);
    const app = buildApp(provider, undefined, {
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 1,
        maxDelayMs: 1,
        jitterRatio: 0
      },
      retrySleep: async () => {}
    });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { message: "Hello after retries" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(provider.calls, 3);
    assert.match(response.json().answer, /Recovered answer/);
  });

  it("streams chat events", async () => {
    const response = await createApp(stubProvider).inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { message: "Hello" }
    });

    assert.equal(response.statusCode, 200);
    assert.match(response.headers["content-type"] as string, /text\/event-stream/);

    const events = parseStreamEvents(response.body);
    assert.deepEqual(events, [
      { type: "start", provider: "fake", model: "stub-model" },
      { type: "delta", text: "Stream " },
      { type: "delta", text: "answer: Hello" },
      {
        type: "usage",
        usage: { inputTokens: 4, outputTokens: 6, totalTokens: 10 },
        latencyMs: events[3]?.type === "usage" ? events[3].latencyMs : -1
      },
      { type: "end" }
    ]);
  });

  it("persists streaming chat messages when a repository is configured", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const app = buildApp(stubProvider, undefined, { conversationRepository });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { userId: "user_1", message: "Persist streamed prompt" }
    });

    assert.equal(response.statusCode, 200);
    const events = parseStreamEvents(response.body);
    assert.equal(events[0]?.type, "start");
    const conversationId = events[0]?.type === "start" ? events[0].conversationId : undefined;
    assert.equal(typeof conversationId, "string");

    const messages = await conversationRepository.listMessages(conversationId ?? "");
    assert.deepEqual(
      messages.map((message) => ({ role: message.role, content: message.content })),
      [
        { role: "user", content: "Persist streamed prompt" },
        { role: "assistant", content: "Stream answer: Persist streamed prompt" }
      ]
    );
  });

  it("streams provider errors as error events", async () => {
    const response = await createApp(failingProvider).inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { message: "Hello" }
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(parseStreamEvents(response.body), [
      { type: "error", message: "Provider unavailable" }
    ]);
  });
});
