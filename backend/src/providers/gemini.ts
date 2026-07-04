import { GoogleGenAI } from "@google/genai";

import { LlmProviderError, type LlmProvider, type LlmResult } from "./types.js";

interface GeminiProviderOptions {
  apiKey: string;
  model: string;
  timeoutSeconds: number;
}

interface GeminiApiError {
  name?: string;
  status?: number;
  message?: string;
}

export class GeminiLlmProvider implements LlmProvider {
  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(options: GeminiProviderOptions) {
    this.client = new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: { timeout: options.timeoutSeconds * 1_000 }
    });
    this.model = options.model;
  }

  async generate(message: string): Promise<LlmResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: message,
        config: {
          systemInstruction:
            "You are a concise AI learning assistant. Answer in the same language as the user."
        }
      });

      if (!response.text) {
        throw new LlmProviderError("The LLM provider returned no text");
      }

      const inputTokens = response.usageMetadata?.promptTokenCount ?? 0;
      const outputTokens = response.usageMetadata?.candidatesTokenCount ?? 0;
      const thinkingTokens = response.usageMetadata?.thoughtsTokenCount ?? 0;

      return {
        text: response.text,
        provider: "gemini",
        model: response.modelVersion ?? this.model,
        usage: {
          inputTokens,
          outputTokens,
          thinkingTokens,
          totalTokens:
            response.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens + thinkingTokens
        }
      };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        throw error;
      }

      const apiError = error as GeminiApiError;
      if (apiError.name === "APIConnectionTimeoutError") {
        throw new LlmProviderError("The LLM provider timed out", {
          cause: error,
          retryable: true
        });
      }
      if (apiError.status === 429) {
        throw new LlmProviderError("Gemini rate limit exceeded. Try again later.", {
          cause: error,
          retryable: true
        });
      }
      if (apiError.status === 401 || apiError.status === 403) {
        throw new LlmProviderError("Gemini authentication or permission failed", {
          cause: error
        });
      }

      throw new LlmProviderError("The LLM provider request failed", {
        cause: error,
        retryable: apiError.status === 500 || apiError.status === 502 || apiError.status === 503
      });
    }
  }

  async *stream(message: string, options?: { signal?: AbortSignal }) {
    try {
      const stream = await this.client.models.generateContentStream({
        model: this.model,
        contents: message,
        config: {
          systemInstruction:
            "You are a concise AI learning assistant. Answer in the same language as the user.",
          abortSignal: options?.signal
        }
      });

      yield { type: "metadata" as const, provider: "gemini" as const, model: this.model };

      let usage = {
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0
      };

      for await (const chunk of stream) {
        if (options?.signal?.aborted) {
          return;
        }
        if (chunk.text) {
          yield { type: "delta" as const, text: chunk.text };
        }

        const inputTokens = chunk.usageMetadata?.promptTokenCount ?? usage.inputTokens;
        const outputTokens = chunk.usageMetadata?.candidatesTokenCount ?? usage.outputTokens;
        const thinkingTokens = chunk.usageMetadata?.thoughtsTokenCount ?? usage.thinkingTokens;
        usage = {
          inputTokens,
          outputTokens,
          thinkingTokens,
          totalTokens:
            chunk.usageMetadata?.totalTokenCount ?? inputTokens + outputTokens + thinkingTokens
        };
      }

      yield { type: "usage" as const, usage };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        throw error;
      }

      const apiError = error as GeminiApiError;
      if (apiError.name === "APIConnectionTimeoutError") {
        throw new LlmProviderError("The LLM provider timed out", {
          cause: error,
          retryable: true
        });
      }
      if (apiError.status === 429) {
        throw new LlmProviderError("Gemini rate limit exceeded. Try again later.", {
          cause: error,
          retryable: true
        });
      }
      if (apiError.status === 401 || apiError.status === 403) {
        throw new LlmProviderError("Gemini authentication or permission failed", {
          cause: error
        });
      }

      throw new LlmProviderError("The LLM provider request failed", {
        cause: error,
        retryable: apiError.status === 500 || apiError.status === 502 || apiError.status === 503
      });
    }
  }
}
