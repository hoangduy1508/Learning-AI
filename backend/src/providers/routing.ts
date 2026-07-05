import { LlmProviderError, type LlmProvider, type LlmResult } from "./types.js";

interface CachedResult {
  expiresAt: number;
  result: LlmResult;
}

export class InMemoryLlmResponseCache {
  private readonly entries = new Map<string, CachedResult>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = () => Date.now()
  ) {}

  get(key: string): LlmResult | null {
    if (this.ttlMs <= 0) {
      return null;
    }

    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }

    return cloneResult(entry.result);
  }

  set(key: string, result: LlmResult): void {
    if (this.ttlMs <= 0) {
      return;
    }

    this.entries.set(key, {
      expiresAt: this.now() + this.ttlMs,
      result: cloneResult(result)
    });
  }
}

export interface RoutingLlmProviderOptions {
  primary: LlmProvider;
  fallback?: LlmProvider;
  cache?: InMemoryLlmResponseCache;
}

export class RoutingLlmProvider implements LlmProvider {
  constructor(private readonly options: RoutingLlmProviderOptions) {}

  async generate(message: string): Promise<LlmResult> {
    const cacheKey = buildCacheKey(message);
    const cached = this.options.cache?.get(cacheKey);
    if (cached) {
      return { ...cached, cacheHit: true };
    }

    try {
      const result = await this.options.primary.generate(message);
      this.options.cache?.set(cacheKey, result);
      return result;
    } catch (error) {
      if (!this.options.fallback || !shouldFallback(error)) {
        throw error;
      }

      const result = await this.options.fallback.generate(message);
      this.options.cache?.set(cacheKey, result);
      return result;
    }
  }

  async *stream(message: string, options?: { signal?: AbortSignal }) {
    yield* this.options.primary.stream(message, options);
  }
}

export function shouldFallback(error: unknown): boolean {
  return error instanceof LlmProviderError && error.retryable;
}

function buildCacheKey(message: string): string {
  return message;
}

function cloneResult(result: LlmResult): LlmResult {
  return {
    text: result.text,
    provider: result.provider,
    model: result.model,
    usage: { ...result.usage },
    cacheHit: result.cacheHit
  };
}
