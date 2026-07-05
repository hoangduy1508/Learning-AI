import { randomUUID } from "node:crypto";

import type { LlmUsage } from "../providers/types.js";

export type ConversationMessageRole = "user" | "assistant";

export interface ConversationRecord {
  id: string;
  userId: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationMessageRecord {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  model: string | null;
  provider: string | null;
  usage: LlmUsage | null;
  estimatedCostUsdMicros: number | null;
  createdAt: Date;
}

export interface CreateConversationMessageInput {
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  model?: string;
  provider?: string;
  usage?: LlmUsage;
  estimatedCostUsdMicros?: number;
}

export interface UserCostSummary {
  userId: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  estimatedCostUsdMicros: number;
}

export interface ConversationRepository {
  createConversation(userId: string, title?: string): Promise<ConversationRecord>;
  findConversationForUser(id: string, userId: string): Promise<ConversationRecord | null>;
  addMessage(input: CreateConversationMessageInput): Promise<ConversationMessageRecord>;
  listMessages(conversationId: string): Promise<ConversationMessageRecord[]>;
  getUserCostSummary(userId: string): Promise<UserCostSummary>;
}

export class InMemoryConversationRepository implements ConversationRepository {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly messages = new Map<string, ConversationMessageRecord[]>();

  async createConversation(userId: string, title?: string): Promise<ConversationRecord> {
    const now = new Date();
    const conversation: ConversationRecord = {
      id: randomUUID(),
      userId,
      title: title ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.conversations.set(conversation.id, conversation);
    this.messages.set(conversation.id, []);
    return conversation;
  }

  async findConversationForUser(id: string, userId: string): Promise<ConversationRecord | null> {
    const conversation = this.conversations.get(id);
    if (!conversation || conversation.userId !== userId) {
      return null;
    }
    return conversation;
  }

  async addMessage(input: CreateConversationMessageInput): Promise<ConversationMessageRecord> {
    const conversation = this.conversations.get(input.conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${input.conversationId}`);
    }

    const message: ConversationMessageRecord = {
      id: randomUUID(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      provider: input.provider ?? null,
      usage: input.usage ?? null,
      estimatedCostUsdMicros: input.estimatedCostUsdMicros ?? null,
      createdAt: new Date()
    };

    this.messages.get(input.conversationId)?.push(message);
    conversation.updatedAt = message.createdAt;
    return message;
  }

  async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
    return [...(this.messages.get(conversationId) ?? [])];
  }

  async getUserCostSummary(userId: string): Promise<UserCostSummary> {
    const userConversationIds = [...this.conversations.values()]
      .filter((conversation) => conversation.userId === userId)
      .map((conversation) => conversation.id);
    const assistantMessages = userConversationIds.flatMap((conversationId) =>
      (this.messages.get(conversationId) ?? []).filter((message) => message.role === "assistant")
    );

    return assistantMessages.reduce<UserCostSummary>(
      (summary, message) => ({
        userId,
        requestCount: summary.requestCount + (message.usage ? 1 : 0),
        inputTokens: summary.inputTokens + (message.usage?.inputTokens ?? 0),
        outputTokens: summary.outputTokens + (message.usage?.outputTokens ?? 0),
        thinkingTokens: summary.thinkingTokens + (message.usage?.thinkingTokens ?? 0),
        totalTokens: summary.totalTokens + (message.usage?.totalTokens ?? 0),
        estimatedCostUsdMicros:
          summary.estimatedCostUsdMicros + (message.estimatedCostUsdMicros ?? 0)
      }),
      {
        userId,
        requestCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        thinkingTokens: 0,
        totalTokens: 0,
        estimatedCostUsdMicros: 0
      }
    );
  }
}
