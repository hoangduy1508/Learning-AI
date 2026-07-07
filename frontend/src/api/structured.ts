export interface StructuredSupportTicket {
  title: string;
  category: "billing" | "technical" | "account" | "general";
  priority: "low" | "medium" | "high";
  customerEmail: string | null;
  summary: string;
  needsHumanReview: boolean;
}

export interface StructuredSupportTicketResult {
  ticket: StructuredSupportTicket;
  rawText: string;
  provider: "fake" | "openai" | "gemini";
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    total_tokens: number;
  };
}

export async function extractSupportTicket(message: string): Promise<StructuredSupportTicketResult> {
  const response = await fetch("/api/structured/support-ticket", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message })
  });
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Structured output request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return data as StructuredSupportTicketResult;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
