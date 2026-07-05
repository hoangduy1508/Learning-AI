import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDeterministicEmbedding } from "../src/embeddings/deterministic.js";
import {
  InMemoryVectorRepository,
  PostgresVectorRepository
} from "../src/vector/repository.js";
import { compareRetrievalQueries, retrievalLabQueries } from "../src/vector/retrieval-lab.js";

describe("vector repository", () => {
  it("stores embeddings with metadata and returns nearest chunks first", async () => {
    const repository = new InMemoryVectorRepository();
    const documentId = await repository.createDocument({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "AI notes"
    });

    await repository.insertChunk({
      documentId,
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      chunkIndex: 0,
      content: "PostgreSQL pgvector stores vector embeddings.",
      metadata: { topic: "vector", page: 1 },
      embedding: createDeterministicEmbedding("postgres pgvector embeddings", 4)
    });
    await repository.insertChunk({
      documentId,
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      chunkIndex: 1,
      content: "Fastify validates request payloads with Zod.",
      metadata: { topic: "backend", page: 2 },
      embedding: createDeterministicEmbedding("fastify zod validation", 4)
    });

    const matches = await repository.searchTopK({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      embedding: createDeterministicEmbedding("how to store embeddings in pgvector", 4),
      topK: 2
    });

    assert.equal(matches.length, 2);
    assert.equal(matches[0]?.metadata.topic, "vector");
    assert.ok(matches[0]!.distance <= matches[1]!.distance);
  });

  it("filters by tenant, user, and metadata before returning context", async () => {
    const repository = new InMemoryVectorRepository();
    const allowedDocumentId = await repository.createDocument({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Allowed notes"
    });
    const otherTenantDocumentId = await repository.createDocument({
      tenantId: "tenant_b",
      ownerUserId: "user_a",
      title: "Other tenant notes"
    });

    const embedding = createDeterministicEmbedding("billing policy", 4);
    await repository.insertChunk({
      documentId: allowedDocumentId,
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      chunkIndex: 0,
      content: "Allowed billing policy",
      metadata: { category: "billing" },
      embedding
    });
    await repository.insertChunk({
      documentId: allowedDocumentId,
      tenantId: "tenant_a",
      ownerUserId: "user_b",
      chunkIndex: 1,
      content: "Wrong user policy",
      metadata: { category: "billing" },
      embedding
    });
    await repository.insertChunk({
      documentId: otherTenantDocumentId,
      tenantId: "tenant_b",
      ownerUserId: "user_a",
      chunkIndex: 0,
      content: "Wrong tenant policy",
      metadata: { category: "billing" },
      embedding
    });
    await repository.insertChunk({
      documentId: allowedDocumentId,
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      chunkIndex: 2,
      content: "Allowed engineering policy",
      metadata: { category: "engineering" },
      embedding
    });

    const matches = await repository.searchTopK({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      embedding,
      topK: 10,
      metadata: { category: "billing" }
    });

    assert.deepEqual(
      matches.map((match) => match.content),
      ["Allowed billing policy"]
    );
  });

  it("builds pgvector SQL with ownership and metadata filters", async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const fakePool = {
      async query(sql: string, values: unknown[]) {
        calls.push({ sql, values });
        return {
          rows: [
            {
              id: "chunk_1",
              document_id: "doc_1",
              content: "Chunk",
              metadata: { topic: "vector" },
              distance: "0.123"
            }
          ]
        };
      }
    };
    const repository = new PostgresVectorRepository(fakePool as never);

    const matches = await repository.searchTopK({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      embedding: [1, 0, 0, 0],
      topK: 3,
      metadata: { topic: "vector" }
    });

    assert.equal(matches[0]?.distance, 0.123);
    assert.match(calls[0]!.sql, /WHERE tenant_id = \$2/);
    assert.match(calls[0]!.sql, /AND owner_user_id = \$3/);
    assert.match(calls[0]!.sql, /metadata ->> \$5 = \$6/);
    assert.deepEqual(calls[0]!.values, ["[1,0,0,0]", "tenant_a", "user_a", 3, "topic", "vector"]);
  });

  it("compares retrieval results across different queries", async () => {
    const results = await compareRetrievalQueries(retrievalLabQueries, 2);

    assert.deepEqual(
      results.map((result) => result.matches[0]?.metadata.topic),
      ["vector", "backend", "frontend", "security"]
    );
    assert.ok(results.every((result) => result.matches.length === 2));
    assert.ok(
      results.every((result) => result.matches[0]!.distance <= result.matches[1]!.distance)
    );
  });
});
