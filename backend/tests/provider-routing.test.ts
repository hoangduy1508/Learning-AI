import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryLlmResponseCache,
  RoutingLlmProvider,
  shouldFallback
} from "../src/providers/routing.js";
import { LlmProviderError, type LlmProvider, type LlmResult } from "../src/providers/types.js";

function result(text: string, model = "test-model"): LlmResult {
  return {
    text,
    provider: "fake",
    model,
    usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 }
  };
}

function createProvider(
  handler: (message: string) => Promise<LlmResult>
): LlmProvider & { calls: number } {
  return {
    calls: 0,
    async generate(message) {
      this.calls += 1;
      return handler(message);
    },
    async *stream(message) {
      const response = await this.generate(message);
      yield { type: "metadata" as const, provider: response.provider, model: response.model };
      yield { type: "delta" as const, text: response.text };
      yield { type: "usage" as const, usage: response.usage };
    }
  };
}

describe("LLM provider routing", () => {
  it("serves repeated prompts from cache until the TTL expires", async () => {
    let now = 1_000;
    const primary = createProvider(async (message) => result(`primary:${message}`));
    const provider = new RoutingLlmProvider({
      primary,
      cache: new InMemoryLlmResponseCache(1_000, () => now)
    });

    assert.equal((await provider.generate("hello")).text, "primary:hello");
    assert.equal((await provider.generate("hello")).text, "primary:hello");
    assert.equal(primary.calls, 1);

    now = 2_001;
    assert.equal((await provider.generate("hello")).text, "primary:hello");
    assert.equal(primary.calls, 2);
  });

  it("uses fallback provider for retryable primary failures", async () => {
    const primary = createProvider(async () => {
      throw new LlmProviderError("temporary outage", { retryable: true });
    });
    const fallback = createProvider(async (message) => result(`fallback:${message}`, "fallback-model"));
    const provider = new RoutingLlmProvider({ primary, fallback });

    const response = await provider.generate("route me");

    assert.equal(response.text, "fallback:route me");
    assert.equal(response.model, "fallback-model");
    assert.equal(primary.calls, 1);
    assert.equal(fallback.calls, 1);
  });

  it("does not fallback for non-retryable primary failures", async () => {
    const primary = createProvider(async () => {
      throw new LlmProviderError("bad credentials");
    });
    const fallback = createProvider(async (message) => result(`fallback:${message}`));
    const provider = new RoutingLlmProvider({ primary, fallback });

    await assert.rejects(provider.generate("do not route"), /bad credentials/);
    assert.equal(primary.calls, 1);
    assert.equal(fallback.calls, 0);
  });

  it("caches fallback results after a retryable primary failure", async () => {
    const primary = createProvider(async () => {
      throw new LlmProviderError("temporary outage", { retryable: true });
    });
    const fallback = createProvider(async (message) => result(`fallback:${message}`));
    const provider = new RoutingLlmProvider({
      primary,
      fallback,
      cache: new InMemoryLlmResponseCache(1_000, () => 1_000)
    });

    assert.equal((await provider.generate("same prompt")).text, "fallback:same prompt");
    assert.equal((await provider.generate("same prompt")).text, "fallback:same prompt");
    assert.equal(primary.calls, 1);
    assert.equal(fallback.calls, 1);
  });

  it("only treats retryable provider errors as fallback candidates", () => {
    assert.equal(shouldFallback(new LlmProviderError("temporary", { retryable: true })), true);
    assert.equal(shouldFallback(new LlmProviderError("auth failed")), false);
    assert.equal(shouldFallback(new Error("unknown")), false);
  });
});
