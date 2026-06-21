import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadConfig } from "../src/config.js";
import { FakeLlmProvider } from "../src/providers/fake.js";
import { GeminiLlmProvider } from "../src/providers/gemini.js";
import { createLlmProvider } from "../src/providers/index.js";
import { OpenAiLlmProvider } from "../src/providers/openai.js";

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
  });

  it("parses filesystem agent auto-apply as an explicit boolean", () => {
    assert.equal(loadConfig({ FILE_AGENT_AUTO_APPLY_WRITES: "true" }).FILE_AGENT_AUTO_APPLY_WRITES, true);
    assert.equal(
      loadConfig({ FILE_AGENT_AUTO_APPLY_WRITES: "false" }).FILE_AGENT_AUTO_APPLY_WRITES,
      false
    );
  });
});
