export type StreamEvent =
  | {
      type: "start";
      provider: string;
      model: string;
    }
  | {
      type: "delta";
      text: string;
    }
  | {
      type: "usage";
      usage: {
        inputTokens: number;
        outputTokens: number;
        thinkingTokens?: number;
        totalTokens: number;
      };
      latencyMs: number;
    }
  | {
      type: "end";
    }
  | {
      type: "error";
      message: string;
    };

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
      const event = parseEventBlock(block);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  flush(): StreamEvent[] {
    const block = this.buffer;
    this.buffer = "";
    const event = parseEventBlock(block);
    return event ? [event] : [];
  }
}

function parseEventBlock(block: string): StreamEvent | null {
  if (block.trim().length === 0) {
    return null;
  }

  const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) {
    throw new Error(`Missing data line in stream event: ${block}`);
  }

  return JSON.parse(dataLine.slice("data: ".length)) as StreamEvent;
}
