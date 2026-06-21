import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  approvePendingAction,
  chatWithFileAgent,
  listPendingActions,
  listToolAudit
} from "../src/api/file-agent";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("file agent api", () => {
  it("posts chat messages to the agent endpoint", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/agent/chat");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ message: "create a file" }));

      return Response.json({
        answer: "Approval required",
        toolCalls: [],
        approvalRequired: {
          id: "pending-1",
          toolName: "write_file",
          args: { path: "notes/a.txt", content: "hello" },
          createdAt: "2026-06-18T00:00:00.000Z"
        },
        executedActions: []
      });
    };

    const response = await chatWithFileAgent("create a file");

    assert.equal(response.answer, "Approval required");
    assert.equal(response.approvalRequired?.toolName, "write_file");
  });

  it("loads pending actions", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/agent/pending");
      return Response.json({
        actions: [
          {
            id: "pending-1",
            toolName: "delete_file",
            args: { path: "old.txt" },
            createdAt: "2026-06-18T00:00:00.000Z"
          }
        ]
      });
    };

    const actions = await listPendingActions();

    assert.equal(actions.length, 1);
    assert.equal(actions[0]?.toolName, "delete_file");
  });

  it("approves a pending action", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/agent/approve");
      assert.equal(init?.method, "POST");
      assert.equal(init?.body, JSON.stringify({ actionId: "pending-1" }));
      return Response.json({ ok: true });
    };

    const result = await approvePendingAction("pending-1");

    assert.deepEqual(result, { ok: true });
  });

  it("loads tool audit entries", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/agent/audit");
      return Response.json({
        entries: [
          {
            id: "audit-1",
            toolName: "write_file",
            args: { path: "notes/a.txt", content: "[redacted 5 bytes]" },
            status: "success",
            autoApplied: true,
            createdAt: "2026-06-21T00:00:00.000Z",
            completedAt: "2026-06-21T00:00:01.000Z"
          }
        ]
      });
    };

    const entries = await listToolAudit();

    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.toolName, "write_file");
    assert.equal(entries[0]?.status, "success");
  });

  it("throws backend detail messages", async () => {
    globalThis.fetch = async () =>
      Response.json({ detail: "Pending action not found" }, { status: 404 });

    await assert.rejects(approvePendingAction("missing"), /Pending action not found/);
  });
});
