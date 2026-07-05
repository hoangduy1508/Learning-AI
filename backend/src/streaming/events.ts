import type { LlmUsage } from "../providers/types.js";

export type StreamEvent =
  | {
      type: "start";
      provider: string;
      model: string;
      conversationId?: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "usage";
      usage: LlmUsage;
      latencyMs: number;
      estimatedCostUsd?: number;
    }
  | {
      type: "end";
    }
  | {
      type: "error";
      message: string;
    };

export function encodeStreamEvent(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function parseStreamEvents(input: string): StreamEvent[] {
  return input
    .split("\n\n")
    .filter((block) => block.trim().length > 0)
    .map((block) => {
      const dataLine = block
        .split("\n")
        .find((line) => line.startsWith("data: "));
      if (!dataLine) {
        throw new Error(`Missing data line in stream event: ${block}`);
      }
      return JSON.parse(dataLine.slice("data: ".length)) as StreamEvent;
    });
}

export class StreamEventParser {
  private buffer = "";

  push(chunk: string): StreamEvent[] {
    this.buffer += chunk;
    const events: StreamEvent[] = [];

    while (true) {
      const boundary = this.buffer.indexOf("\n\n");
      if (boundary === -1) {
        break;
      }

      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      if (block.trim().length === 0) {
        continue;
      }
      events.push(...parseStreamEvents(`${block}\n\n`));
    }

    return events;
  }

  flush(): StreamEvent[] {
    if (this.buffer.trim().length === 0) {
      this.buffer = "";
      return [];
    }

    const remaining = this.buffer;
    this.buffer = "";
    return parseStreamEvents(remaining.endsWith("\n\n") ? remaining : `${remaining}\n\n`);
  }
}
