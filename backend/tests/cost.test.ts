import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { estimateCostUsdMicros, usdMicrosToUsd } from "../src/cost.js";

describe("cost estimation", () => {
  it("estimates provider cost in micro USD from token usage and configured pricing", () => {
    const cost = estimateCostUsdMicros(
      { inputTokens: 1_000, outputTokens: 200, thinkingTokens: 50, totalTokens: 1_250 },
      {
        inputUsdPerMillionTokens: 0.1,
        outputUsdPerMillionTokens: 0.4,
        thinkingUsdPerMillionTokens: 0.2
      }
    );

    assert.equal(cost, 190);
    assert.equal(usdMicrosToUsd(cost), 0.00019);
  });
});
