import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { LlmProviderError, type LlmProvider } from "../src/providers/types.js";

const stubProvider: LlmProvider = {
  async generate(message) {
    return {
      text: `Answer to: ${message}`,
      provider: "fake",
      model: "stub-model",
      usage: { inputTokens: 3, outputTokens: 5, totalTokens: 8 }
    };
  }
};

const failingProvider: LlmProvider = {
  async generate() {
    throw new LlmProviderError("Provider unavailable");
  }
};

const apps: ReturnType<typeof buildApp>[] = [];

function createApp(provider: LlmProvider) {
  const app = buildApp(provider);
  apps.push(app);
  return app;
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
});
