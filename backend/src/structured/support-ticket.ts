import { z } from "zod";

import { LlmProviderError, type LlmProvider, type LlmResult } from "../providers/types.js";

const supportTicketRequestSchema = z.object({
  message: z.string().min(1).max(5_000)
});

export const supportTicketSchema = z.object({
  title: z.string().min(3).max(120),
  category: z.enum(["billing", "technical", "account", "general"]),
  priority: z.enum(["low", "medium", "high"]),
  customerEmail: z.string().email().nullable(),
  summary: z.string().min(10).max(1_000),
  needsHumanReview: z.boolean()
});

export type SupportTicket = z.infer<typeof supportTicketSchema>;

export type SupportTicketRequest = z.infer<typeof supportTicketRequestSchema>;

export interface StructuredSupportTicketResult {
  ticket: SupportTicket;
  rawText: string;
  provider: LlmResult["provider"];
  model: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    thinking_tokens: number;
    total_tokens: number;
  };
}

export class StructuredOutputError extends Error {
  constructor(
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "StructuredOutputError";
  }
}

export function validateSupportTicketRequest(input: unknown): SupportTicketRequest {
  return supportTicketRequestSchema.parse(input);
}

export function buildSupportTicketPrompt(message: string): string {
  return [
    "Extract a support ticket from the user message.",
    "Return only one JSON object and no markdown.",
    "The JSON object must have this shape:",
    JSON.stringify(
      {
        title: "short issue title",
        category: "billing | technical | account | general",
        priority: "low | medium | high",
        customerEmail: "email string or null",
        summary: "specific plain-language summary",
        needsHumanReview: true
      },
      null,
      2
    ),
    "Use null for customerEmail when the message does not include one.",
    "Set needsHumanReview to true for payment, cancellation, security, or angry-customer issues.",
    "",
    `User message: ${message}`
  ].join("\n");
}

export function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/iu, "")
    .replace(/\s*```$/u, "")
    .trim();

  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    throw new StructuredOutputError("Model output was not valid JSON", {
      cause: error instanceof Error ? error.message : String(error),
      rawText: text
    });
  }
}

export function parseSupportTicket(text: string): SupportTicket {
  const parsedJson = parseJsonObject(text);
  const parsedTicket = supportTicketSchema.safeParse(parsedJson);

  if (!parsedTicket.success) {
    throw new StructuredOutputError("Model JSON did not match the support ticket schema", {
      errors: parsedTicket.error.flatten()
    });
  }

  return parsedTicket.data;
}

export async function extractSupportTicket(
  provider: LlmProvider,
  message: string
): Promise<StructuredSupportTicketResult> {
  const result = await provider.generate(buildSupportTicketPrompt(message));

  try {
    const ticket = parseSupportTicket(result.text);
    return {
      ticket,
      rawText: result.text,
      provider: result.provider,
      model: result.model,
      usage: {
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        thinking_tokens: result.usage.thinkingTokens ?? 0,
        total_tokens: result.usage.totalTokens
      }
    };
  } catch (error) {
    if (error instanceof StructuredOutputError) {
      throw error;
    }

    throw new LlmProviderError("The LLM provider returned unusable structured output", {
      cause: error
    });
  }
}
