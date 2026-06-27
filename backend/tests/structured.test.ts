import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import type { LlmProvider } from "../src/providers/types.js";
import { parseSupportTicket } from "../src/structured/support-ticket.js";

function createProvider(text: string): LlmProvider {
  return {
    async generate(message) {
      return {
        text,
        provider: "fake",
        model: "structured-test-model",
        usage: {
          inputTokens: message.split(/\s+/u).length,
          outputTokens: text.split(/\s+/u).length,
          totalTokens: message.split(/\s+/u).length + text.split(/\s+/u).length
        }
      };
    },

    async *stream() {
      yield { type: "metadata" as const, provider: "fake" as const, model: "unused" };
    }
  };
}

const apps: ReturnType<typeof buildApp>[] = [];

function createApp(provider: LlmProvider) {
  const app = buildApp(provider);
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("structured support ticket output", () => {
  it("parses a valid support ticket from fenced JSON", () => {
    const ticket = parseSupportTicket(`\`\`\`json
{
  "title": "Cannot access invoice",
  "category": "billing",
  "priority": "high",
  "customerEmail": "linh@example.com",
  "summary": "The customer cannot access the latest invoice in the billing page.",
  "needsHumanReview": true
}
\`\`\``);

    assert.deepEqual(ticket, {
      title: "Cannot access invoice",
      category: "billing",
      priority: "high",
      customerEmail: "linh@example.com",
      summary: "The customer cannot access the latest invoice in the billing page.",
      needsHumanReview: true
    });
  });

  it("exposes a structured extraction endpoint", async () => {
    const response = await createApp(
      createProvider(
        JSON.stringify({
          title: "Password reset link expired",
          category: "account",
          priority: "medium",
          customerEmail: null,
          summary: "The customer says the password reset link expired before they could use it.",
          needsHumanReview: false
        })
      )
    ).inject({
      method: "POST",
      url: "/api/structured/support-ticket",
      payload: { message: "My password reset link expired." }
    });

    assert.equal(response.statusCode, 200);
    const body = response.json();
    assert.equal(body.ticket.title, "Password reset link expired");
    assert.equal(body.ticket.category, "account");
    assert.equal(body.provider, "fake");
    assert.equal(body.model, "structured-test-model");
    assert.equal(typeof body.usage.total_tokens, "number");
  });

  it("rejects malformed JSON from the model", async () => {
    const response = await createApp(createProvider("{not-json")).inject({
      method: "POST",
      url: "/api/structured/support-ticket",
      payload: { message: "Please open a support ticket." }
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().detail, "Model output was not valid JSON");
  });

  it("rejects JSON that does not match the Zod schema", async () => {
    const response = await createApp(
      createProvider(
        JSON.stringify({
          title: "ok",
          category: "refund",
          priority: "urgent",
          customerEmail: "not-an-email",
          summary: "too short",
          needsHumanReview: "yes"
        })
      )
    ).inject({
      method: "POST",
      url: "/api/structured/support-ticket",
      payload: { message: "I want a refund now." }
    });

    assert.equal(response.statusCode, 422);
    assert.equal(response.json().detail, "Model JSON did not match the support ticket schema");
  });
});
