import { StreamEventParser, type StreamEvent } from "../lib/stream-events";

interface StreamChatOptions {
  message: string;
  signal: AbortSignal;
  onEvent(event: StreamEvent): void;
}

export async function streamChat(options: StreamChatOptions): Promise<void> {
  const response = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: options.message }),
    signal: options.signal
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error("Streaming response body is unavailable");
  }

  const parser = new StreamEventParser();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });
    for (const event of parser.push(chunk)) {
      options.onEvent(event);
    }
  }

  const finalChunk = decoder.decode();
  for (const event of parser.push(finalChunk)) {
    options.onEvent(event);
  }
  for (const event of parser.flush()) {
    options.onEvent(event);
  }
}
