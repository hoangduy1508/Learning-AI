import type { LlmProvider, LlmResult } from "./types.js";

function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

export class FakeLlmProvider implements LlmProvider {
  async generate(message: string): Promise<LlmResult> {
    const text = `Fake LLM response: ${message}`;
    const inputTokens = countWords(message);
    const outputTokens = countWords(text);

    return {
      text,
      provider: "fake",
      model: "fake-learning-model",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      }
    };
  }
}
