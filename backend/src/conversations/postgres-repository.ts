import { randomUUID } from "node:crypto";

import type { QueryResult } from "pg";

import type { LlmUsage } from "../providers/types.js";
import type {
  ConversationMessageRecord,
  ConversationRecord,
  ConversationRepository,
  CreateConversationMessageInput
} from "./repository.js";
import { conversationSchemaSql } from "./schema.js";

interface Queryable {
  query<T extends object = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>;
}

interface ConversationRow {
  id: string;
  user_id: string;
  title: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ConversationMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  thinking_tokens: number | null;
  total_tokens: number | null;
  created_at: Date | string;
}

export async function runConversationMigrations(database: Queryable): Promise<void> {
  await database.query(conversationSchemaSql);
}

export class PostgresConversationRepository implements ConversationRepository {
  constructor(private readonly database: Queryable) {}

  async createConversation(userId: string, title?: string): Promise<ConversationRecord> {
    const result = await this.database.query<ConversationRow>(
      `
        INSERT INTO conversations (id, user_id, title)
        VALUES ($1, $2, $3)
        RETURNING id, user_id, title, created_at, updated_at
      `,
      [randomUUID(), userId, title ?? null]
    );

    return mapConversationRow(requireSingleRow(result));
  }

  async findConversationForUser(id: string, userId: string): Promise<ConversationRecord | null> {
    const result = await this.database.query<ConversationRow>(
      `
        SELECT id, user_id, title, created_at, updated_at
        FROM conversations
        WHERE id = $1 AND user_id = $2
      `,
      [id, userId]
    );

    return result.rows[0] ? mapConversationRow(result.rows[0]) : null;
  }

  async addMessage(input: CreateConversationMessageInput): Promise<ConversationMessageRecord> {
    const result = await this.database.query<ConversationMessageRow>(
      `
        WITH inserted_message AS (
          INSERT INTO conversation_messages (
            id,
            conversation_id,
            role,
            content,
            provider,
            model,
            input_tokens,
            output_tokens,
            thinking_tokens,
            total_tokens
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING
            id,
            conversation_id,
            role,
            content,
            provider,
            model,
            input_tokens,
            output_tokens,
            thinking_tokens,
            total_tokens,
            created_at
        )
        UPDATE conversations
        SET updated_at = inserted_message.created_at
        FROM inserted_message
        WHERE conversations.id = inserted_message.conversation_id
        RETURNING
          inserted_message.id,
          inserted_message.conversation_id,
          inserted_message.role,
          inserted_message.content,
          inserted_message.provider,
          inserted_message.model,
          inserted_message.input_tokens,
          inserted_message.output_tokens,
          inserted_message.thinking_tokens,
          inserted_message.total_tokens,
          inserted_message.created_at
      `,
      [
        randomUUID(),
        input.conversationId,
        input.role,
        input.content,
        input.provider ?? null,
        input.model ?? null,
        input.usage?.inputTokens ?? null,
        input.usage?.outputTokens ?? null,
        input.usage?.thinkingTokens ?? null,
        input.usage?.totalTokens ?? null
      ]
    );

    return mapMessageRow(requireSingleRow(result));
  }

  async listMessages(conversationId: string): Promise<ConversationMessageRecord[]> {
    const result = await this.database.query<ConversationMessageRow>(
      `
        SELECT
          id,
          conversation_id,
          role,
          content,
          provider,
          model,
          input_tokens,
          output_tokens,
          thinking_tokens,
          total_tokens,
          created_at
        FROM conversation_messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
      `,
      [conversationId]
    );

    return result.rows.map(mapMessageRow);
  }
}

function requireSingleRow<T extends object>(result: QueryResult<T>): T {
  const row = result.rows[0];
  if (!row) {
    throw new Error("Expected database query to return a row");
  }
  return row;
}

function mapConversationRow(row: ConversationRow): ConversationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: toDate(row.created_at),
    updatedAt: toDate(row.updated_at)
  };
}

function mapMessageRow(row: ConversationMessageRow): ConversationMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    provider: row.provider,
    model: row.model,
    usage: mapUsage(row),
    createdAt: toDate(row.created_at)
  };
}

function mapUsage(row: ConversationMessageRow): LlmUsage | null {
  if (row.input_tokens === null || row.output_tokens === null || row.total_tokens === null) {
    return null;
  }

  const usage: LlmUsage = {
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    totalTokens: row.total_tokens
  };

  if (row.thinking_tokens !== null) {
    usage.thinkingTokens = row.thinking_tokens;
  }

  return usage;
}

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}
