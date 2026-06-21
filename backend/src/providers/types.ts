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
}

export interface LlmProvider {
  generate(message: string): Promise<LlmResult>;
  stream(message: string, options?: { signal?: AbortSignal }): AsyncGenerator<LlmStreamEvent>;
}

export class LlmProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmProviderError";
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
