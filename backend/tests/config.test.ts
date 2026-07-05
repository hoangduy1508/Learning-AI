import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config.js";
import { FakeLlmProvider } from "../src/providers/fake.js";
import { GeminiLlmProvider } from "../src/providers/gemini.js";
import { createLlmProvider } from "../src/providers/index.js";
import { OpenAiLlmProvider } from "../src/providers/openai.js";
import { RoutingLlmProvider } from "../src/providers/routing.js";

describe("multi-provider configuration", () => {
  it("creates the fake provider by default", () => {
    const config = loadConfig({});
    assert.ok(createLlmProvider(config) instanceof FakeLlmProvider);
  });

  it("creates the Gemini provider when configured", () => {
    const config = loadConfig({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "test-key" });
    assert.ok(createLlmProvider(config) instanceof GeminiLlmProvider);
  });

  it("creates the OpenAI provider when configured", () => {
    const config = loadConfig({ LLM_PROVIDER: "openai", OPENAI_API_KEY: "test-key" });
    assert.ok(createLlmProvider(config) instanceof OpenAiLlmProvider);
  });

  it("requires credentials for the selected provider", () => {
    assert.throws(() => loadConfig({ LLM_PROVIDER: "gemini" }), /GEMINI_API_KEY/);
    assert.throws(() => loadConfig({ LLM_PROVIDER: "openai" }), /OPENAI_API_KEY/);
    assert.throws(
      () => loadConfig({ LLM_PROVIDER: "fake", LLM_FALLBACK_PROVIDER: "gemini" }),
      /GEMINI_API_KEY/
    );
  });

  it("parses filesystem agent auto-apply as an explicit boolean", () => {
    assert.equal(loadConfig({ FILE_AGENT_AUTO_APPLY_WRITES: "true" }).FILE_AGENT_AUTO_APPLY_WRITES, true);
    assert.equal(
      loadConfig({ FILE_AGENT_AUTO_APPLY_WRITES: "false" }).FILE_AGENT_AUTO_APPLY_WRITES,
      false
    );
  });

  it("parses optional database configuration", () => {
    const config = loadConfig({
      DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:5432/ai_learning",
      DATABASE_SSL: "true",
      DATABASE_RUN_MIGRATIONS: "false"
    });

    assert.equal(config.DATABASE_URL, "postgres://postgres:postgres@127.0.0.1:5432/ai_learning");
    assert.equal(config.DATABASE_SSL, true);
    assert.equal(config.DATABASE_RUN_MIGRATIONS, false);
  });

  it("treats empty optional environment variables as unset", () => {
    const config = loadConfig({
      DATABASE_URL: "",
      OPENAI_API_KEY: "",
      GEMINI_API_KEY: ""
    });

    assert.equal(config.DATABASE_URL, undefined);
    assert.equal(config.OPENAI_API_KEY, undefined);
    assert.equal(config.GEMINI_API_KEY, undefined);
  });

  it("parses LLM retry configuration", () => {
    const config = loadConfig({
      LLM_RETRY_MAX_ATTEMPTS: "4",
      LLM_RETRY_BASE_DELAY_MS: "100",
      LLM_RETRY_MAX_DELAY_MS: "1500",
      LLM_RETRY_JITTER_RATIO: "0.35"
    });

    assert.equal(config.LLM_RETRY_MAX_ATTEMPTS, 4);
    assert.equal(config.LLM_RETRY_BASE_DELAY_MS, 100);
    assert.equal(config.LLM_RETRY_MAX_DELAY_MS, 1500);
    assert.equal(config.LLM_RETRY_JITTER_RATIO, 0.35);
  });

  it("parses chat rate limit configuration", () => {
    const config = loadConfig({
      CHAT_RATE_LIMIT_MAX_REQUESTS: "5",
      CHAT_RATE_LIMIT_WINDOW_MS: "30000"
    });

    assert.equal(config.CHAT_RATE_LIMIT_MAX_REQUESTS, 5);
    assert.equal(config.CHAT_RATE_LIMIT_WINDOW_MS, 30_000);
  });

  it("parses ingestion upload limit configuration", () => {
    const config = loadConfig({ INGESTION_MAX_FILE_BYTES: "2048" });

    assert.equal(config.INGESTION_MAX_FILE_BYTES, 2_048);
  });

  it("wraps the primary provider when fallback or cache is configured", () => {
    assert.ok(
      createLlmProvider(
        loadConfig({ LLM_PROVIDER: "fake", LLM_FALLBACK_PROVIDER: "gemini", GEMINI_API_KEY: "key" })
      ) instanceof RoutingLlmProvider
    );
    assert.ok(
      createLlmProvider(loadConfig({ LLM_PROVIDER: "fake", CHAT_CACHE_TTL_MS: "5000" })) instanceof
        RoutingLlmProvider
    );
  });

  it("parses provider cost configuration", () => {
    const config = loadConfig({
      OPENAI_INPUT_USD_PER_1M_TOKENS: "0.15",
      OPENAI_OUTPUT_USD_PER_1M_TOKENS: "0.6",
      GEMINI_INPUT_USD_PER_1M_TOKENS: "0.1",
      GEMINI_OUTPUT_USD_PER_1M_TOKENS: "0.4"
    });

    assert.equal(config.OPENAI_INPUT_USD_PER_1M_TOKENS, 0.15);
    assert.equal(config.OPENAI_OUTPUT_USD_PER_1M_TOKENS, 0.6);
    assert.equal(config.GEMINI_INPUT_USD_PER_1M_TOKENS, 0.1);
    assert.equal(config.GEMINI_OUTPUT_USD_PER_1M_TOKENS, 0.4);
  });
});
