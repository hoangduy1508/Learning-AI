export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
}

export interface LlmResult {
  text: string;
  provider: "fake" | "openai" | "gemini";
  model: string;
  usage: LlmUsage;
  cacheHit?: boolean;
}

export interface LlmProvider {
  generate(message: string): Promise<LlmResult>;
  stream(message: string, options?: { signal?: AbortSignal }): AsyncGenerator<LlmStreamEvent>;
}

interface LlmProviderErrorOptions extends ErrorOptions {
  retryable?: boolean;
}

export class LlmProviderError extends Error {
  readonly retryable: boolean;

  constructor(message: string, options: LlmProviderErrorOptions = {}) {
    super(message, options);
    this.name = "LlmProviderError";
    this.retryable = options.retryable ?? false;
  }
}

export type LlmStreamEvent =
  | {
      type: "metadata";
      provider: LlmResult["provider"];
      model: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "usage";
      usage: LlmUsage;
    };
