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

  async *stream(message: string, options?: { signal?: AbortSignal }) {
    const result = await this.generate(message);
    yield { type: "metadata" as const, provider: result.provider, model: result.model };

    for (const part of result.text.split(/(\s+)/u).filter(Boolean)) {
      if (options?.signal?.aborted) {
        return;
      }
      yield { type: "delta" as const, text: part };
    }

    yield { type: "usage" as const, usage: result.usage };
  }
}
