import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import { InMemoryVectorRepository, type VectorSearchMatch } from "./repository.js";

export interface RetrievalComparisonResult {
  query: string;
  matches: VectorSearchMatch[];
}

const tenantId = "tenant_lab";
const ownerUserId = "user_lab";
const labDimension = 32;

const labChunks = [
  {
    content: "PostgreSQL pgvector embedding vector storage and cosine search.",
    metadata: { topic: "vector", page: 1 }
  },
  {
    content: "Fastify Zod backend route validation and provider request handling.",
    metadata: { topic: "backend", page: 2 }
  },
  {
    content: "React streaming chunks improve perceived latency in chat UI.",
    metadata: { topic: "frontend", page: 3 }
  },
  {
    content: "Tenant metadata authorization filter protects retrieval context.",
    metadata: { topic: "security", page: 4 }
  }
];

export const retrievalLabQueries = [
  "pgvector embedding cosine search",
  "fastify backend zod validation",
  "react streaming latency",
  "tenant authorization metadata filter"
];

export async function compareRetrievalQueries(
  queries = retrievalLabQueries,
  topK = 2
): Promise<RetrievalComparisonResult[]> {
  const repository = new InMemoryVectorRepository();
  const documentId = await repository.createDocument({
    tenantId,
    ownerUserId,
    title: "Retrieval comparison lab",
    sourceUri: "memory://retrieval-comparison"
  });

  for (const [chunkIndex, chunk] of labChunks.entries()) {
    await repository.insertChunk({
      documentId,
      tenantId,
      ownerUserId,
      chunkIndex,
      content: chunk.content,
      metadata: chunk.metadata,
      embedding: createDeterministicEmbedding(chunk.content, labDimension)
    });
  }

  const results: RetrievalComparisonResult[] = [];
  for (const query of queries) {
    results.push({
      query,
      matches: await repository.searchTopK({
        tenantId,
        ownerUserId,
        embedding: createDeterministicEmbedding(query, labDimension),
        topK
      })
    });
  }

  return results;
}
