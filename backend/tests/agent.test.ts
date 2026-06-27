import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { FileAgentService } from "../src/agent/file-agent.js";
import { loadConfig } from "../src/config.js";

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "ai-learning-agent-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function createAutoApplyAgent(): FileAgentService {
  let callCount = 0;
  const fakeClient = {
    models: {
      async generateContent() {
        callCount += 1;
        if (callCount === 1) {
          return {
            functionCalls: [
              {
                name: "write_file",
                args: {
                  path: "notes/agent-qa.txt",
                  content: "hello from audit log test",
                  createDirs: true
                }
              }
            ]
          };
        }

        return {
          text: "Created notes/agent-qa.txt.",
          functionCalls: []
        };
      }
    }
  };

  return new FileAgentService(
    loadConfig({
      FILE_TOOL_ALLOWED_ROOTS: root,
      FILE_TOOL_ALLOW_WRITE: "true",
      FILE_TOOL_ALLOW_DELETE: "true",
      FILE_AGENT_AUTO_APPLY_WRITES: "true"
    }),
    fakeClient
  );
}

function createAgentWithToolCall(args: Record<string, unknown>): FileAgentService {
  const fakeClient = {
    models: {
      async generateContent() {
        return {
          functionCalls: [
            {
              name: "write_file",
              args
            }
          ]
        };
      }
    }
  };

  return new FileAgentService(
    loadConfig({
      FILE_TOOL_ALLOWED_ROOTS: root,
      FILE_TOOL_ALLOW_WRITE: "true",
      FILE_TOOL_ALLOW_DELETE: "true",
      FILE_AGENT_AUTO_APPLY_WRITES: "true"
    }),
    fakeClient
  );
}

function createWeatherAgent(args: Record<string, unknown>): FileAgentService {
  let callCount = 0;
  const fakeClient = {
    models: {
      async generateContent() {
        callCount += 1;
        if (callCount === 1) {
          return {
            functionCalls: [
              {
                name: "get_weather",
                args
              }
            ]
          };
        }

        return {
          text: "The fake weather result is ready.",
          functionCalls: []
        };
      }
    }
  };

  return new FileAgentService(
    loadConfig({
      FILE_TOOL_ALLOWED_ROOTS: root,
      FILE_TOOL_ALLOW_WRITE: "true",
      FILE_TOOL_ALLOW_DELETE: "true",
      FILE_AGENT_AUTO_APPLY_WRITES: "true"
    }),
    fakeClient
  );
}

describe("FileAgentService", () => {
  it("auto-applies write tools and records a redacted audit entry", async () => {
    const agent = createAutoApplyAgent();

    const response = await agent.chat("Create a small QA file.");

    assert.equal(response.answer, "Created notes/agent-qa.txt.");
    assert.equal(response.executedActions?.length, 1);
    assert.equal(
      await readFile(path.join(root, "notes", "agent-qa.txt"), "utf8"),
      "hello from audit log test"
    );

    const audit = agent.listAuditLog();
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.toolName, "write_file");
    assert.equal(audit[0]?.status, "success");
    assert.equal(audit[0]?.autoApplied, true);
    assert.equal(audit[0]?.args.content, "[redacted 25 bytes]");
    assert.deepEqual(audit[0]?.result, {
      path: path.join(root, "notes", "agent-qa.txt"),
      bytes: 25
    });
  });

  it("rejects malformed write arguments and records an audit error", async () => {
    const agent = createAgentWithToolCall({ path: "notes/malformed.txt" });

    await assert.rejects(agent.chat("Write without content."), /Missing required argument: content/);

    const audit = agent.listAuditLog();
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.toolName, "write_file");
    assert.equal(audit[0]?.status, "error");
    assert.equal(audit[0]?.error, "Missing required argument: content");
  });

  it("rejects write tools outside the allowed root and records an audit error", async () => {
    const agent = createAgentWithToolCall({
      path: "..\\outside.txt",
      content: "should not be written"
    });

    await assert.rejects(agent.chat("Write outside the root."), /outside configured allowed roots/);

    const audit = agent.listAuditLog();
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.toolName, "write_file");
    assert.equal(audit[0]?.status, "error");
    assert.equal(audit[0]?.args.content, "[redacted 21 bytes]");
    assert.equal(audit[0]?.error, "Path is outside configured allowed roots");
  });

  it("executes the fake weather tool with validated arguments", async () => {
    const agent = createWeatherAgent({ location: "Ho Chi Minh City", unit: "celsius" });

    const response = await agent.chat("What is the weather in Ho Chi Minh City?");

    assert.equal(response.answer, "The fake weather result is ready.");
    assert.equal(response.toolCalls.length, 1);
    assert.equal(response.toolCalls[0]?.name, "get_weather");
    assert.deepEqual(response.toolCalls[0]?.result, {
      location: "Ho Chi Minh City",
      unit: "celsius",
      temperature: 27,
      condition: "sunny",
      humidityPercent: 65,
      source: "fake-weather-tool"
    });

    const audit = agent.listAuditLog();
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.toolName, "get_weather");
    assert.equal(audit[0]?.status, "success");
    assert.equal(audit[0]?.autoApplied, true);
  });

  it("rejects malformed weather arguments and records an audit error", async () => {
    const agent = createWeatherAgent({ location: "", unit: "kelvin" });

    await assert.rejects(agent.chat("Weather please."), /String must contain at least 2 character/);

    const audit = agent.listAuditLog();
    assert.equal(audit.length, 1);
    assert.equal(audit[0]?.toolName, "get_weather");
    assert.equal(audit[0]?.status, "error");
    assert.match(audit[0]?.error ?? "", /String must contain at least 2 character/);
  });
});
