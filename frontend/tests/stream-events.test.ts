import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { StreamEventParser } from "../src/lib/stream-events";

describe("StreamEventParser", () => {
  it("parses events split across chunks", () => {
    const source =
      'event: delta\ndata: {"type":"delta","text":"Xin"}\n\n' +
      'event: delta\ndata: {"type":"delta","text":" chào"}\n\n' +
      'event: end\ndata: {"type":"end"}\n\n';

    const parser = new StreamEventParser();
    const events = [
      ...parser.push(source.slice(0, 7)),
      ...parser.push(source.slice(7, 41)),
      ...parser.push(source.slice(41, 75)),
      ...parser.push(source.slice(75)),
      ...parser.flush()
    ];

    assert.deepEqual(events, [
      { type: "delta", text: "Xin" },
      { type: "delta", text: " chào" },
      { type: "end" }
    ]);
  });
});
