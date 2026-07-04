import { LlmProviderError } from "./types.js";

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

interface RetryOptions extends RetryPolicy {
  random?: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  onRetry?: (event: { attempt: number; delayMs: number; error: LlmProviderError }) => void;
}

interface ResolvedRetryOptions extends RetryPolicy {
  random: () => number;
  sleep: (delayMs: number) => Promise<void>;
  onRetry?: (event: { attempt: number; delayMs: number; error: LlmProviderError }) => void;
}

export const defaultRetryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
  jitterRatio: 0.2
};

export async function retryLlmProviderCall<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const policy = resolveRetryOptions(options);
  let attempt = 1;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof LlmProviderError)) {
        throw error;
      }

      if (!error.retryable || attempt >= policy.maxAttempts) {
        throw error;
      }

      const delayMs = calculateRetryDelayMs(attempt, policy);
      policy.onRetry?.({ attempt, delayMs, error });
      await policy.sleep(delayMs);
      attempt += 1;
    }
  }
}

export function calculateRetryDelayMs(
  failedAttempt: number,
  options: Pick<RetryOptions, "baseDelayMs" | "maxDelayMs" | "jitterRatio" | "random">
): number {
  const exponentialDelay = Math.min(
    options.maxDelayMs,
    options.baseDelayMs * 2 ** Math.max(0, failedAttempt - 1)
  );
  if (options.jitterRatio <= 0) {
    return exponentialDelay;
  }

  const random = options.random ?? Math.random;
  const jitterRange = exponentialDelay * options.jitterRatio;
  const jitter = (random() * 2 - 1) * jitterRange;
  return Math.max(0, Math.round(exponentialDelay + jitter));
}

function resolveRetryOptions(options: Partial<RetryOptions>): ResolvedRetryOptions {
  return {
    maxAttempts: options.maxAttempts ?? defaultRetryPolicy.maxAttempts,
    baseDelayMs: options.baseDelayMs ?? defaultRetryPolicy.baseDelayMs,
    maxDelayMs: options.maxDelayMs ?? defaultRetryPolicy.maxDelayMs,
    jitterRatio: options.jitterRatio ?? defaultRetryPolicy.jitterRatio,
    random: options.random ?? Math.random,
    sleep: options.sleep ?? sleep,
    onRetry: options.onRetry
  };
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}
