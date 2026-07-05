export interface RateLimitPolicy {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly policy: RateLimitPolicy,
    private readonly now: () => number = () => Date.now()
  ) {}

  consume(key: string): RateLimitDecision {
    const currentTime = this.now();
    const existingBucket = this.buckets.get(key);
    const bucket =
      existingBucket && existingBucket.resetAt > currentTime
        ? existingBucket
        : { count: 0, resetAt: currentTime + this.policy.windowMs };

    if (bucket.count >= this.policy.maxRequests) {
      this.buckets.set(key, bucket);
      return {
        allowed: false,
        limit: this.policy.maxRequests,
        remaining: 0,
        resetAt: bucket.resetAt,
        retryAfterMs: Math.max(0, bucket.resetAt - currentTime)
      };
    }

    bucket.count += 1;
    this.buckets.set(key, bucket);

    return {
      allowed: true,
      limit: this.policy.maxRequests,
      remaining: Math.max(0, this.policy.maxRequests - bucket.count),
      resetAt: bucket.resetAt,
      retryAfterMs: Math.max(0, bucket.resetAt - currentTime)
    };
  }
}
