import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { extractSupportTicket } from "../src/api/structured";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("structured output api", () => {
  it("extracts a support ticket", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/structured/support-ticket");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ message: "Invoice issue" }));
      return Response.json({
        ticket: {
          title: "Invoice issue",
          category: "billing",
          priority: "high",
          customerEmail: null,
          summary: "Customer cannot download invoice.",
          needsHumanReview: true
        },
        rawText: "{}",
        provider: "fake",
        model: "stub",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          thinking_tokens: 0,
          total_tokens: 15
        }
      });
    };

    const result = await extractSupportTicket("Invoice issue");

    assert.equal(result.ticket.category, "billing");
    assert.equal(result.usage.total_tokens, 15);
  });

  it("throws backend detail messages", async () => {
    globalThis.fetch = async () => Response.json({ detail: "Invalid request" }, { status: 422 });

    await assert.rejects(extractSupportTicket(""), /Invalid request/);
  });
});
