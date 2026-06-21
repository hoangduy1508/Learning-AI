import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { streamChat } from "../src/api/chat-stream";
import type { StreamEvent } from "../src/lib/stream-events";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("streamChat", () => {
  it("reads streaming fetch chunks and emits parsed events", async () => {
    const encoded =
      'event: start\ndata: {"type":"start","provider":"fake","model":"stub"}\n\n' +
      'event: delta\ndata: {"type":"delta","text":"Xin"}\n\n' +
      'event: delta\ndata: {"type":"delta","text":" chào"}\n\n' +
      'event: usage\ndata: {"type":"usage","usage":{"inputTokens":1,"outputTokens":2,"totalTokens":3},"latencyMs":10}\n\n' +
      'event: end\ndata: {"type":"end"}\n\n';

    globalThis.fetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode(encoded.slice(0, 11)));
            controller.enqueue(encoder.encode(encoded.slice(11, 72)));
            controller.enqueue(encoder.encode(encoded.slice(72)));
            controller.close();
          }
        }),
        { status: 200 }
      );

    const events: StreamEvent[] = [];
    await streamChat({
      message: "Hello",
      signal: new AbortController().signal,
      onEvent: (event) => events.push(event)
    });

    assert.deepEqual(events, [
      { type: "start", provider: "fake", model: "stub" },
      { type: "delta", text: "Xin" },
      { type: "delta", text: " chào" },
      {
        type: "usage",
        usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
        latencyMs: 10
      },
      { type: "end" }
    ]);
  });

  it("throws for non-2xx responses", async () => {
    globalThis.fetch = async () => new Response("bad", { status: 502 });

    await assert.rejects(
      streamChat({
        message: "Hello",
        signal: new AbortController().signal,
        onEvent: () => undefined
      }),
      /status 502/
    );
  });
});
