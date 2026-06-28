import { createHash } from "node:crypto";
import { z } from "zod";

export const supportTicketToolInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  category: z.enum(["billing", "technical", "account", "general"]),
  priority: z.enum(["low", "medium", "high"]),
  customerEmail: z.string().email().nullable().optional(),
  summary: z.string().trim().min(10).max(1_000),
  idempotencyKey: z.string().trim().min(8).max(120),
  confirmation: z.literal("CREATE_TICKET")
});

export const supportTicketToolProposalSchema = supportTicketToolInputSchema.omit({
  confirmation: true
});

export type SupportTicketToolInput = z.infer<typeof supportTicketToolInputSchema>;

export interface SupportTicketToolResult {
  ticketId: string;
  title: string;
  category: SupportTicketToolInput["category"];
  priority: SupportTicketToolInput["priority"];
  customerEmail: string | null;
  summary: string;
  createdByUserId: string;
  status: "open";
  idempotencyKey: string;
  deduplicated: boolean;
  source: "fake-support-ticket-store";
}

export class FakeSupportTicketStore {
  private readonly ticketsByIdempotencyKey = new Map<string, SupportTicketToolResult>();

  create(input: unknown, currentUserId: string): SupportTicketToolResult {
    const parsed = supportTicketToolInputSchema.parse(input);
    const existing = this.ticketsByIdempotencyKey.get(parsed.idempotencyKey);
    if (existing) {
      return { ...existing, deduplicated: true };
    }

    const ticket: SupportTicketToolResult = {
      ticketId: `tkt_${createHash("sha256")
        .update(`${currentUserId}:${parsed.idempotencyKey}`)
        .digest("hex")
        .slice(0, 10)}`,
      title: parsed.title,
      category: parsed.category,
      priority: parsed.priority,
      customerEmail: parsed.customerEmail ?? null,
      summary: parsed.summary,
      createdByUserId: currentUserId,
      status: "open",
      idempotencyKey: parsed.idempotencyKey,
      deduplicated: false,
      source: "fake-support-ticket-store"
    };

    this.ticketsByIdempotencyKey.set(parsed.idempotencyKey, ticket);
    return ticket;
  }
}
