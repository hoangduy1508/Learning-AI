import { randomUUID } from "node:crypto";

import type { Pool, PoolClient } from "pg";

import { cosineDistance, formatVectorLiteral } from "../embeddings/deterministic.js";

export interface VectorDocumentInput {
  id?: string;
  tenantId: string;
  ownerUserId: string;
  title: string;
  sourceUri?: string;
}

export interface VectorChunkInput {
  id?: string;
  documentId: string;
  tenantId: string;
  ownerUserId: string;
  chunkIndex: number;
  content: string;
  metadata?: Record<string, unknown>;
  embedding: number[];
}

export interface VectorSearchQuery {
  tenantId: string;
  ownerUserId: string;
  embedding: number[];
  topK: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface KeywordSearchQuery {
  tenantId: string;
  ownerUserId: string;
  query: string;
  topK: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface VectorSearchMatch {
  id: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  distance: number;
}

export interface KeywordSearchMatch extends Omit<VectorSearchMatch, "distance"> {
  score: number;
}

export interface VectorRepository {
  createDocument(input: VectorDocumentInput): Promise<string>;
  insertChunk(input: VectorChunkInput): Promise<string>;
  searchTopK(query: VectorSearchQuery): Promise<VectorSearchMatch[]>;
  searchKeyword(query: KeywordSearchQuery): Promise<KeywordSearchMatch[]>;
}

interface StoredChunk extends Required<Omit<VectorChunkInput, "metadata">> {
  metadata: Record<string, unknown>;
}

export class InMemoryVectorRepository implements VectorRepository {
  private readonly documents = new Map<string, Required<VectorDocumentInput>>();
  private readonly chunks = new Map<string, StoredChunk>();

  async createDocument(input: VectorDocumentInput): Promise<string> {
    const id = input.id ?? randomUUID();
    this.documents.set(id, {
      id,
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId,
      title: input.title,
      sourceUri: input.sourceUri ?? ""
    });
    return id;
  }

  async insertChunk(input: VectorChunkInput): Promise<string> {
    if (!this.documents.has(input.documentId)) {
      throw new Error(`Document ${input.documentId} does not exist`);
    }

    const id = input.id ?? randomUUID();
    this.chunks.set(id, {
      id,
      documentId: input.documentId,
      tenantId: input.tenantId,
      ownerUserId: input.ownerUserId,
      chunkIndex: input.chunkIndex,
      content: input.content,
      metadata: input.metadata ?? {},
      embedding: input.embedding
    });
    return id;
  }

  async searchTopK(query: VectorSearchQuery): Promise<VectorSearchMatch[]> {
    return [...this.chunks.entries()]
      .filter(([, chunk]) => {
        return (
          chunk.tenantId === query.tenantId &&
          chunk.ownerUserId === query.ownerUserId &&
          metadataMatches(chunk.metadata, query.metadata)
        );
      })
      .map(([id, chunk]) => ({
        id,
        documentId: chunk.documentId,
        content: chunk.content,
        metadata: chunk.metadata,
        distance: cosineDistance(query.embedding, chunk.embedding)
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, query.topK);
  }

  async searchKeyword(query: KeywordSearchQuery): Promise<KeywordSearchMatch[]> {
    const terms = tokenize(query.query);
    if (terms.length === 0) {
      return [];
    }

    const candidates = [...this.chunks.entries()].filter(([, chunk]) => {
      return (
        chunk.tenantId === query.tenantId &&
        chunk.ownerUserId === query.ownerUserId &&
        metadataMatches(chunk.metadata, query.metadata)
      );
    });
    const documentFrequency = new Map<string, number>();
    for (const term of new Set(terms)) {
      documentFrequency.set(
        term,
        candidates.filter(([, chunk]) => tokenize(chunk.content).includes(term)).length
      );
    }

    return candidates
      .map(([id, chunk]) => {
        const chunkTokens = tokenize(chunk.content);
        const score = terms.reduce((sum, term) => {
          const termFrequency = chunkTokens.filter((token) => token === term).length;
          if (termFrequency === 0) {
            return sum;
          }
          const inverseDocumentFrequency = Math.log(
            1 + (candidates.length - (documentFrequency.get(term) ?? 0) + 0.5) /
              ((documentFrequency.get(term) ?? 0) + 0.5)
          );
          return sum + termFrequency * inverseDocumentFrequency;
        }, 0);
        return {
          id,
          documentId: chunk.documentId,
          content: chunk.content,
          metadata: chunk.metadata,
          score
        };
      })
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, query.topK);
  }
}

export class PostgresVectorRepository implements VectorRepository {
  constructor(private readonly pool: Pool) {}

  async createDocument(input: VectorDocumentInput): Promise<string> {
    const id = input.id ?? randomUUID();
    await this.pool.query(
      `
        INSERT INTO rag_documents (id, tenant_id, owner_user_id, title, source_uri)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [id, input.tenantId, input.ownerUserId, input.title, input.sourceUri ?? null]
    );
    return id;
  }

  async insertChunk(input: VectorChunkInput): Promise<string> {
    const id = input.id ?? randomUUID();
    await this.pool.query(
      `
        INSERT INTO rag_document_chunks (
          id,
          document_id,
          tenant_id,
          owner_user_id,
          chunk_index,
          content,
          metadata,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
      `,
      [
        id,
        input.documentId,
        input.tenantId,
        input.ownerUserId,
        input.chunkIndex,
        input.content,
        input.metadata ?? {},
        formatVectorLiteral(input.embedding)
      ]
    );
    return id;
  }

  async searchTopK(query: VectorSearchQuery): Promise<VectorSearchMatch[]> {
    const values: unknown[] = [
      formatVectorLiteral(query.embedding),
      query.tenantId,
      query.ownerUserId,
      query.topK
    ];
    const metadataSql = buildMetadataFilterSql(query.metadata, values);

    const result = await this.pool.query<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      distance: string;
    }>(
      `
        SELECT id, document_id, content, metadata, embedding <=> $1::vector AS distance
        FROM rag_document_chunks
        WHERE tenant_id = $2
          AND owner_user_id = $3
          ${metadataSql}
        ORDER BY embedding <=> $1::vector
        LIMIT $4
      `,
      values
    );

    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      distance: Number(row.distance)
    }));
  }

  async searchKeyword(query: KeywordSearchQuery): Promise<KeywordSearchMatch[]> {
    const values: unknown[] = [query.query, query.tenantId, query.ownerUserId, query.topK];
    const metadataSql = buildMetadataFilterSql(query.metadata, values);

    const result = await this.pool.query<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: string;
    }>(
      `
        SELECT
          id,
          document_id,
          content,
          metadata,
          ts_rank(to_tsvector('simple', content), websearch_to_tsquery('simple', $1)) AS score
        FROM rag_document_chunks
        WHERE tenant_id = $2
          AND owner_user_id = $3
          AND to_tsvector('simple', content) @@ websearch_to_tsquery('simple', $1)
          ${metadataSql}
        ORDER BY score DESC
        LIMIT $4
      `,
      values
    );

    return result.rows.map((row) => ({
      id: row.id,
      documentId: row.document_id,
      content: row.content,
      metadata: row.metadata,
      score: Number(row.score)
    }));
  }
}

function metadataMatches(
  metadata: Record<string, unknown>,
  filter: VectorSearchQuery["metadata"]
): boolean {
  if (!filter) {
    return true;
  }

  return Object.entries(filter).every(([key, value]) => metadata[key] === value);
}

function buildMetadataFilterSql(
  metadata: VectorSearchQuery["metadata"],
  values: unknown[]
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  const conditions = Object.entries(metadata).map(([key, value]) => {
    values.push(key, String(value));
    const keyIndex = values.length - 1;
    const valueIndex = values.length;
    return `AND metadata ->> $${keyIndex} = $${valueIndex}`;
  });

  return conditions.join("\n          ");
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
}

export type VectorQueryable = Pool | PoolClient;
