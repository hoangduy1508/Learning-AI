import type { AppConfig } from "../config.js";
import { FakeLlmProvider } from "./fake.js";
import { GeminiLlmProvider } from "./gemini.js";
import { OpenAiLlmProvider } from "./openai.js";
import type { LlmProvider } from "./types.js";

export function createLlmProvider(config: AppConfig): LlmProvider {
  if (config.LLM_PROVIDER === "openai") {
    if (!config.OPENAI_API_KEY) {
      throw new Error("OpenAI API key is missing");
    }
    return new OpenAiLlmProvider({
      apiKey: config.OPENAI_API_KEY,
      model: config.OPENAI_MODEL,
      timeoutSeconds: config.LLM_TIMEOUT_SECONDS
    });
  }

  if (config.LLM_PROVIDER === "gemini") {
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
