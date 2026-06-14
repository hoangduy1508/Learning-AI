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
        throw new LlmProviderError("The LLM provider timed out", { cause: error });
      }
      if (apiError.status === 429) {
        throw new LlmProviderError("Gemini rate limit exceeded. Try again later.", {
          cause: error
        });
      }
      if (apiError.status === 401 || apiError.status === 403) {
        throw new LlmProviderError("Gemini authentication or permission failed", {
          cause: error
        });
      }

      throw new LlmProviderError("The LLM provider request failed", { cause: error });
    }
  }
}
