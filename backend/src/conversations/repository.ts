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
  createdAt: Date;
}

export interface CreateConversationMessageInput {
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  model?: string;
  provider?: string;
  usage?: LlmUsage;
}

export interface ConversationRepository {
  createConversation(userId: string, title?: string): Promise<ConversationRecord>;
  findConversationForUser(id: string, userId: string): Promise<ConversationRecord | null>;
  addMessage(input: CreateConversationMessageInput): Promise<ConversationMessageRecord>;
  listMessages(conversationId: string): Promise<ConversationMessageRecord[]>;
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
      createdAt: new Date()
    };

    this.messages.get(input.conversationId)?.push(message);
    conversation.updatedAt = message.createdAt;
    return message;
  }

  async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
    return [...(this.messages.get(conversationId) ?? [])];
  }
}
