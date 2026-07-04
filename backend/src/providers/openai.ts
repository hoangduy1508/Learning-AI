import OpenAI from "openai";

import { LlmProviderError, type LlmProvider, type LlmResult } from "./types.js";

interface OpenAiProviderOptions {
  apiKey: string;
  model: string;
  timeoutSeconds: number;
}

export class OpenAiLlmProvider implements LlmProvider {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAiProviderOptions) {
    this.client = new OpenAI({
      apiKey: options.apiKey,
      timeout: options.timeoutSeconds * 1_000
    });
    this.model = options.model;
  }

  async generate(message: string): Promise<LlmResult> {
    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions:
          "You are a concise AI learning assistant. Answer in the same language as the user.",
        input: message
      });

      if (!response.output_text) {
        throw new LlmProviderError("The LLM provider returned no text");
      }

      const inputTokens = response.usage?.input_tokens ?? 0;
      const outputTokens = response.usage?.output_tokens ?? 0;

      return {
        text: response.output_text,
        provider: "openai",
        model: response.model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens
        }
      };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        throw error;
      }
      if (error instanceof OpenAI.APIConnectionTimeoutError) {
        throw new LlmProviderError("The LLM provider timed out", {
          cause: error,
          retryable: true
        });
      }
      if (error instanceof OpenAI.RateLimitError && error.code === "insufficient_quota") {
        throw new LlmProviderError(
          "OpenAI quota is unavailable. Check API billing and usage limits.",
          { cause: error }
        );
      }
      if (error instanceof OpenAI.RateLimitError) {
        throw new LlmProviderError("OpenAI rate limit exceeded. Try again later.", {
          cause: error,
          retryable: true
        });
      }
      throw new LlmProviderError("The LLM provider request failed", { cause: error });
    }
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
