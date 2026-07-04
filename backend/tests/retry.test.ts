import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { calculateRetryDelayMs, retryLlmProviderCall } from "../src/providers/retry.js";
import { LlmProviderError } from "../src/providers/types.js";

describe("LLM retry policy", () => {
  it("calculates exponential backoff with capped jitter", () => {
    assert.equal(
      calculateRetryDelayMs(1, {
        baseDelayMs: 100,
        maxDelayMs: 1_000,
        jitterRatio: 0,
        random: () => 0.5
      }),
      100
    );
    assert.equal(
      calculateRetryDelayMs(4, {
        baseDelayMs: 100,
        maxDelayMs: 500,
        jitterRatio: 0,
        random: () => 0.5
      }),
      500
    );
    assert.equal(
      calculateRetryDelayMs(2, {
        baseDelayMs: 100,
        maxDelayMs: 1_000,
        jitterRatio: 0.25,
        random: () => 1
      }),
      250
    );
  });

  it("retries retryable provider errors and returns the eventual result", async () => {
    let calls = 0;
    const delays: number[] = [];

    const result = await retryLlmProviderCall(
      async () => {
        calls += 1;
        if (calls < 3) {
          throw new LlmProviderError("temporary", { retryable: true });
        }
        return "ok";
      },
      {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
        jitterRatio: 0,
        sleep: async (delayMs) => {
          delays.push(delayMs);
        }
      }
    );

    assert.equal(result, "ok");
    assert.equal(calls, 3);
    assert.deepEqual(delays, [10, 20]);
  });

  it("does not retry non-retryable provider errors", async () => {
    let calls = 0;

    await assert.rejects(
      retryLlmProviderCall(
        async () => {
          calls += 1;
          throw new LlmProviderError("bad request");
        },
        {
          maxAttempts: 3,
          baseDelayMs: 10,
          maxDelayMs: 100,
          jitterRatio: 0,
          sleep: async () => {}
        }
      ),
      /bad request/
    );

    assert.equal(calls, 1);
  });
});
