import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { LlmProvider } from "../src/providers/types.js";

const provider: LlmProvider = {
  async generate() {
    return {
      text: "ok",
      provider: "fake",
      model: "fake",
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
    };
  },
  async *stream() {
    yield { type: "metadata" as const, provider: "fake" as const, model: "fake" };
  }
};

let root: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), "ai-learning-files-"));
  await writeFile(path.join(root, "notes.txt"), "hello agent\nsearch target\n", "utf8");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

function createApp(options: { allowWrite?: boolean; allowDelete?: boolean } = {}) {
  const config = loadConfig({
    FILE_TOOL_ALLOWED_ROOTS: root,
    FILE_TOOL_ALLOW_WRITE: String(options.allowWrite ?? false),
    FILE_TOOL_ALLOW_DELETE: String(options.allowDelete ?? false)
  });
  return buildApp(provider, config);
}

describe("filesystem tool routes", () => {
  it("lists, reads, and searches files inside an allowed root", async () => {
    const app = createApp();

    const roots = await app.inject({ method: "GET", url: "/api/files/roots" });
    assert.equal(roots.statusCode, 200);
    assert.deepEqual(roots.json().roots, [root]);

    const list = await app.inject({
      method: "POST",
      url: "/api/files/list",
      payload: { path: "." }
    });
    assert.equal(list.statusCode, 200);
    assert.equal(list.json().entries[0].name, "notes.txt");

    const read = await app.inject({
      method: "POST",
      url: "/api/files/read",
      payload: { path: "notes.txt" }
    });
    assert.equal(read.statusCode, 200);
    assert.equal(read.json().content, "hello agent\nsearch target\n");

    const search = await app.inject({
      method: "POST",
      url: "/api/files/search",
      payload: { query: "target" }
    });
    assert.equal(search.statusCode, 200);
    assert.equal(search.json().matches[0].line, 2);

    await app.close();
  });

  it("blocks reads outside the allowed root", async () => {
    const app = createApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/files/read",
      payload: { path: "..\\outside.txt" }
    });

    assert.equal(response.statusCode, 403);
    await app.close();
  });

  it("requires write/delete flags before mutating files", async () => {
    const app = createApp();
    const write = await app.inject({
      method: "POST",
      url: "/api/files/write",
      payload: { path: "new.txt", content: "new content" }
    });
    assert.equal(write.statusCode, 403);
    await app.close();
  });

  it("writes and deletes files when explicitly enabled", async () => {
    const app = createApp({ allowWrite: true, allowDelete: true });

    const write = await app.inject({
      method: "POST",
      url: "/api/files/write",
      payload: { path: "nested/new.txt", content: "new content", createDirs: true }
    });
    assert.equal(write.statusCode, 200);
    assert.equal(await readFile(path.join(root, "nested", "new.txt"), "utf8"), "new content");

    const del = await app.inject({
      method: "POST",
      url: "/api/files/delete",
      payload: { path: "nested/new.txt", confirmation: "DELETE" }
    });
    assert.equal(del.statusCode, 200);
    assert.equal(del.json().deleted, true);

    await app.close();
  });
});
