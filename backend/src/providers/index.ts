import type { AppConfig } from "../config.js";
import { FakeLlmProvider } from "./fake.js";
import { GeminiLlmProvider } from "./gemini.js";
import { OpenAiLlmProvider } from "./openai.js";
import { InMemoryLlmResponseCache, RoutingLlmProvider } from "./routing.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(config: AppConfig): LlmProvider {
  const primary = createProvider(config, config.LLM_PROVIDER);
  const fallback =
    config.LLM_FALLBACK_PROVIDER !== "none" && config.LLM_FALLBACK_PROVIDER !== config.LLM_PROVIDER
      ? createProvider(config, config.LLM_FALLBACK_PROVIDER)
      : undefined;

  if (!fallback && config.CHAT_CACHE_TTL_MS === 0) {
    return primary;
  }

  return new RoutingLlmProvider({
    primary,
    fallback,
    cache:
      config.CHAT_CACHE_TTL_MS > 0
        ? new InMemoryLlmResponseCache(config.CHAT_CACHE_TTL_MS)
        : undefined
  });
}

function createProvider(
  config: AppConfig,
  providerName: "fake" | "openai" | "gemini"
): LlmProvider {
  if (providerName === "openai") {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is missing");
    }
    return new OpenAiLlmProvider({
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
      timeoutSeconds: config.LLM_TIMEOUT_SECONDS
    });
  }

  if (providerName === "gemini") {
    if (!config.GEMINI_API_KEY) {
      throw new Error("Gemini API key is missing");
    }
    return new GeminiLlmProvider({
      apiKey: config.GEMINI_API_KEY,
      model: config.GEMINI_MODEL,
      timeoutSeconds: config.LLM_TIMEOUT_SECONDS
    });
  }

  return new FakeLlmProvider();
}
