import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { InMemoryConversationRepository } from "../src/conversations/repository.js";
import { LlmProviderError, type LlmProvider } from "../src/providers/types.js";
import { InMemoryRateLimiter } from "../src/rate-limit.js";
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

const meteredProvider: LlmProvider = {
  async generate() {
    return {
      text: "Metered answer",
      provider: "openai",
      model: "metered-model",
      usage: { inputTokens: 1_000, outputTokens: 500, thinkingTokens: 100, totalTokens: 1_600 }
    };
  },

  async *stream() {
    yield { type: "metadata" as const, provider: "openai" as const, model: "metered-model" };
    yield { type: "delta" as const, text: "Metered stream" };
    yield {
      type: "usage" as const,
      usage: { inputTokens: 1_000, outputTokens: 500, thinkingTokens: 100, totalTokens: 1_600 }
    };
  }
};

const cachedMeteredProvider: LlmProvider = {
  async generate() {
    return {
      text: "Cached answer",
      provider: "openai",
      model: "metered-model",
      usage: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500 },
      cacheHit: true
    };
  },

  async *stream() {
    yield { type: "metadata" as const, provider: "openai" as const, model: "metered-model" };
    yield { type: "delta" as const, text: "Cached stream" };
    yield {
      type: "usage" as const,
      usage: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500 }
    };
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

  it("rate limits chat requests by user", async () => {
    const app = buildApp(stubProvider, undefined, {
      rateLimiter: new InMemoryRateLimiter({ maxRequests: 2, windowMs: 60_000 }, () => 1_000)
    });
    apps.push(app);

    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/chat",
          payload: { userId: "user_1", message: "First" }
        })
      ).statusCode,
      200
    );
    assert.equal(
      (
        await app.inject({
          method: "POST",
          url: "/api/chat",
          payload: { userId: "user_1", message: "Second" }
        })
      ).statusCode,
      200
    );

    const blocked = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "Third" }
    });
    assert.equal(blocked.statusCode, 429);
    assert.deepEqual(blocked.json(), { detail: "Rate limit exceeded", retry_after_ms: 60_000 });
    assert.equal(blocked.headers["ratelimit-limit"], "2");
    assert.equal(blocked.headers["ratelimit-remaining"], "0");
    assert.equal(blocked.headers["retry-after"], "60");

    const otherUser = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_2", message: "Independent bucket" }
    });
    assert.equal(otherUser.statusCode, 200);
  });

  it("does not persist rate-limited chat requests", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const app = buildApp(stubProvider, undefined, {
      conversationRepository,
      rateLimiter: new InMemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 }, () => 1_000)
    });
    apps.push(app);

    const firstResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "Allowed" }
    });
    assert.equal(firstResponse.statusCode, 200);

    const conversationId = firstResponse.json().conversation_id;
    const blocked = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", conversationId, message: "Blocked" }
    });

    assert.equal(blocked.statusCode, 429);
    const messages = await conversationRepository.listMessages(conversationId);
    assert.deepEqual(
      messages.map((message) => message.content),
      ["Allowed", "Answer to: Allowed"]
    );
  });

  it("tracks estimated request cost and summarizes it by user", async () => {
    const conversationRepository = new InMemoryConversationRepository();
    const app = buildApp(
      meteredProvider,
      loadConfig({
        LLM_PROVIDER: "fake",
        OPENAI_INPUT_USD_PER_1M_TOKENS: "1",
        OPENAI_OUTPUT_USD_PER_1M_TOKENS: "2",
        OPENAI_THINKING_USD_PER_1M_TOKENS: "0.5"
      }),
      { conversationRepository }
    );
    apps.push(app);

    const chatResponse = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "Track cost" }
    });

    assert.equal(chatResponse.statusCode, 200);
    assert.equal(chatResponse.json().estimated_cost_usd, 0.00205);
    assert.equal(chatResponse.json().cache_hit, false);

    const summaryResponse = await app.inject({
      method: "GET",
      url: "/api/users/user_1/cost-summary"
    });

    assert.equal(summaryResponse.statusCode, 200);
    assert.deepEqual(summaryResponse.json(), {
      user_id: "user_1",
      request_count: 1,
      input_tokens: 1_000,
      output_tokens: 500,
      thinking_tokens: 100,
      total_tokens: 1_600,
      estimated_cost_usd: 0.00205,
      estimated_cost_usd_micros: 2_050
    });
  });

  it("does not estimate new provider cost for cached chat responses", async () => {
    const app = buildApp(
      cachedMeteredProvider,
      loadConfig({
        LLM_PROVIDER: "fake",
        OPENAI_INPUT_USD_PER_1M_TOKENS: "1",
        OPENAI_OUTPUT_USD_PER_1M_TOKENS: "2"
      })
    );
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/chat",
      payload: { userId: "user_1", message: "Cached prompt" }
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.json().cache_hit, true);
    assert.equal(response.json().usage.total_tokens, 1_500);
    assert.equal(response.json().estimated_cost_usd, 0);
  });

  it("uploads and ingests a supported document", async () => {
    const app = createApp(stubProvider);
    const response = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "Upload guide",
        sourceUri: "memory://upload-guide.txt",
        fileName: "upload-guide.txt",
        mimeType: "text/plain",
        content: "Upload validation happens before ingestion."
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.file_name, "upload-guide.txt");
    assert.equal(body.mime_type, "text/plain");
    assert.equal(body.status, "indexed");
    assert.equal(body.version, 1);
    assert.equal(body.chunk_count, 1);
    assert.equal(typeof body.checksum, "string");
  });

  it("uploads and ingests a base64 PDF while preserving extracted pages", async () => {
    const app = createApp(stubProvider);
    const response = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "PDF guide",
        sourceUri: "memory://pdf-guide.pdf",
        fileName: "pdf-guide.pdf",
        mimeType: "application/pdf",
        contentEncoding: "base64",
        content: createMinimalPdfBase64(["First PDF page", "Second PDF page"])
      }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.mime_type, "application/pdf");
    assert.equal(body.page_count, 2);
    assert.equal(body.status, "indexed");
  });

  it("rejects unsupported ingestion upload MIME types", async () => {
    const response = await createApp(stubProvider).inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "Bad file",
        sourceUri: "memory://bad.exe",
        fileName: "bad.exe",
        mimeType: "application/octet-stream",
        content: "binary"
      }
    });

    assert.equal(response.statusCode, 422);
    assert.match(response.json().errors.mimeType[0], /Invalid enum value/);
  });

  it("rejects ingestion uploads over the configured byte limit", async () => {
    const app = buildApp(
      stubProvider,
      loadConfig({ LLM_PROVIDER: "fake", INGESTION_MAX_FILE_BYTES: "10" })
    );
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "Too large",
        sourceUri: "memory://too-large.txt",
        fileName: "too-large.txt",
        mimeType: "text/plain",
        content: "This content is longer than ten bytes."
      }
    });

    assert.equal(response.statusCode, 422);
    assert.match(response.json().errors.content[0], /File is too large/);
  });

  it("skips duplicate ingestion uploads with the same checksum", async () => {
    const app = createApp(stubProvider);
    const payload = {
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Duplicate guide",
      sourceUri: "memory://duplicate-guide.txt",
      fileName: "duplicate-guide.txt",
      mimeType: "text/plain",
      content: "Do not index this twice."
    };

    const first = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.equal(first.json().status, "indexed");
    assert.equal(second.json().status, "skipped_duplicate");
    assert.equal(second.json().chunk_count, 0);
    assert.equal(second.json().document_id, first.json().document_id);
  });

  it("queries uploaded documents with RAG citations", async () => {
    const app = createApp(stubProvider);
    const upload = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "RAG UI guide",
        sourceUri: "memory://rag-ui-guide.txt",
        fileName: "rag-ui-guide.txt",
        mimeType: "text/plain",
        content: "Hybrid retrieval combines keyword evidence with vector similarity for citations."
      }
    });

    const query = await app.inject({
      method: "POST",
      url: "/api/rag/query",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        query: "How does hybrid retrieval work?",
        strategy: "hybrid",
        topK: 3,
        similarityThreshold: 0.01
      }
    });

    assert.equal(upload.statusCode, 200);
    assert.equal(query.statusCode, 200);
    assert.equal(query.json().status, "answered");
    assert.equal(query.json().citations[0].documentId, upload.json().document_id);
    assert.equal(query.json().citations[0].pageNumber, 1);
  });

  it("evaluates uploaded document retrieval from user-provided cases", async () => {
    const app = createApp(stubProvider);
    const upload = await app.inject({
      method: "POST",
      url: "/api/ingestion/upload",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "Evaluation guide",
        sourceUri: "memory://evaluation-guide.txt",
        fileName: "evaluation-guide.txt",
        mimeType: "text/plain",
        content: "Citation correctness checks whether the cited page supports the answer."
      }
    });

    const evaluation = await app.inject({
      method: "POST",
      url: "/api/rag/evaluate",
      payload: {
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        strategy: "hybrid",
        topK: 3,
        similarityThreshold: 0.01,
        cases: [
          {
            id: "case_1",
            question: "What does citation correctness check?",
            expectedAnswerContains: ["Citation correctness"],
            expectedDocumentId: upload.json().document_id,
            expectedPageNumber: 1
          }
        ]
      }
    });

    assert.equal(evaluation.statusCode, 200);
    assert.equal(evaluation.json().caseCount, 1);
    assert.match(evaluation.json().report, /Citation correctness/);
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
        latencyMs: events[3]?.type === "usage" ? events[3].latencyMs : -1,
        estimatedCostUsd: 0
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

  it("rate limits streaming chat requests by user before opening an event stream", async () => {
    const app = buildApp(stubProvider, undefined, {
      rateLimiter: new InMemoryRateLimiter({ maxRequests: 1, windowMs: 60_000 }, () => 1_000)
    });
    apps.push(app);

    const allowed = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { userId: "user_1", message: "First stream" }
    });
    assert.equal(allowed.statusCode, 200);

    const blocked = await app.inject({
      method: "POST",
      url: "/api/chat/stream",
      payload: { userId: "user_1", message: "Second stream" }
    });
    assert.equal(blocked.statusCode, 429);
    assert.match(blocked.headers["content-type"] as string, /application\/json/);
    assert.deepEqual(blocked.json(), { detail: "Rate limit exceeded", retry_after_ms: 60_000 });
  });
});

function createMinimalPdfBase64(pageTexts: string[]): string {
  const objects = new Map<number, string>();
  const fontObjectId = 3;
  const pageObjectIds = pageTexts.map((_, index) => 4 + index);
  const contentObjectIds = pageTexts.map((_, index) => 4 + pageTexts.length + index);

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${
      pageTexts.length
    } >>`
  );
  objects.set(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const [index, text] of pageTexts.entries()) {
    const pageObjectId = pageObjectIds[index]!;
    const contentObjectId = contentObjectIds[index]!;
    const stream = `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentObjectId} 0 R >>`
    );
    objects.set(contentObjectId, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const objectId of [...objects.keys()].sort((left, right) => left - right)) {
    offsets[objectId] = Buffer.byteLength(pdf, "ascii");
    pdf += `${objectId} 0 obj\n${objects.get(objectId)!}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  const objectCount = Math.max(...objects.keys()) + 1;
  pdf += `xref\n0 ${objectCount}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId < objectCount; objectId += 1) {
    pdf += `${String(offsets[objectId] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii").toString("base64");
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}
