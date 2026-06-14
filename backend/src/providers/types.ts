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
}

export class LlmProviderError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "LlmProviderError";
  }
}
