import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { getCostSummary } from "../src/api/cost-summary";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("getCostSummary", () => {
  it("loads a persisted user cost summary", async () => {
    let requestedUrl = "";
    globalThis.fetch = async (input) => {
      requestedUrl = String(input);
      return Response.json({
        user_id: "demo-user",
        request_count: 2,
        input_tokens: 10,
        output_tokens: 20,
        thinking_tokens: 0,
        total_tokens: 30,
        estimated_cost_usd: 0.0001,
        estimated_cost_usd_micros: 100
      });
    };

    const summary = await getCostSummary("demo-user");

    assert.equal(requestedUrl, "/api/users/demo-user/cost-summary");
    assert.equal(summary.request_count, 2);
    assert.equal(summary.estimated_cost_usd_micros, 100);
  });

  it("throws when the backend cannot provide a summary", async () => {
    globalThis.fetch = async () => new Response("no persistence", { status: 503 });

    await assert.rejects(getCostSummary("demo-user"), /status 503/);
  });
});
