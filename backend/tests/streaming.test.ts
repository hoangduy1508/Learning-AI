import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { encodeStreamEvent, StreamEventParser } from "../src/streaming/events.js";

describe("stream event parser", () => {
  it("parses events split across arbitrary chunks", () => {
    const encoded =
      encodeStreamEvent({ type: "delta", text: "Hel" }) +
      encodeStreamEvent({ type: "delta", text: "lo" }) +
      encodeStreamEvent({ type: "end" });

    const parser = new StreamEventParser();
    const events = [
      ...parser.push(encoded.slice(0, 5)),
      ...parser.push(encoded.slice(5, 17)),
      ...parser.push(encoded.slice(17, 31)),
      ...parser.push(encoded.slice(31)),
      ...parser.flush()
    ];

    assert.deepEqual(events, [
      { type: "delta", text: "Hel" },
      { type: "delta", text: "lo" },
      { type: "end" }
    ]);
  });
});

