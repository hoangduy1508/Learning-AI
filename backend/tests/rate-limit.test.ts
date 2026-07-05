import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InMemoryRateLimiter } from "../src/rate-limit.js";

describe("in-memory rate limiter", () => {
  it("allows requests until the user bucket is full", () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimiter(
      { maxRequests: 2, windowMs: 1_000 },
      () => now
    );

    assert.deepEqual(limiter.consume("user_1"), {
      allowed: true,
      limit: 2,
      remaining: 1,
      resetAt: 2_000,
      retryAfterMs: 1_000
    });
    assert.equal(limiter.consume("user_1").allowed, true);

    const blocked = limiter.consume("user_1");
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.retryAfterMs, 1_000);

    now = 2_001;
    const afterReset = limiter.consume("user_1");
    assert.equal(afterReset.allowed, true);
    assert.equal(afterReset.remaining, 1);
    assert.equal(afterReset.resetAt, 3_001);
  });

  it("keeps separate buckets per key", () => {
    const limiter = new InMemoryRateLimiter({ maxRequests: 1, windowMs: 1_000 }, () => 1_000);

    assert.equal(limiter.consume("user_1").allowed, true);
    assert.equal(limiter.consume("user_1").allowed, false);
    assert.equal(limiter.consume("user_2").allowed, true);
  });
});
