import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import {
  createDeterministicEmbedding,
  formatVectorLiteral
} from "../embeddings/deterministic.js";
import { pgvectorSchemaSql } from "../vector/schema.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for the pgvector smoke test");
}

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false
});

interface SearchRow {
  content: string;
  distance: string;
}

try {
  await pool.query(pgvectorSchemaSql);
  await pool.query("TRUNCATE rag_document_chunks, rag_documents CASCADE");

  const tenantId = "tenant_demo";
  const userId = "user_demo";
  const documentId = randomUUID();
  await pool.query(
    `
      INSERT INTO rag_documents (id, tenant_id, owner_user_id, title, source_uri)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [documentId, tenantId, userId, "AI learning notes", "memory://pgvector-smoke"]
  );

  const chunks = [
    "PostgreSQL pgvector stores embeddings for semantic search.",
    "Fastify routes validate user input before calling providers.",
    "React streams answer chunks to improve perceived latency."
  ];

  for (const [index, content] of chunks.entries()) {
    await pool.query(
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
        randomUUID(),
        documentId,
        tenantId,
        userId,
        index,
        content,
        { source: "pgvector-smoke", chunkIndex: index },
        formatVectorLiteral(createDeterministicEmbedding(content, 4))
      ]
    );
  }

  const queryEmbedding = formatVectorLiteral(
    createDeterministicEmbedding("How do I store vectors in PostgreSQL?", 4)
  );
  const searchResult = await pool.query<SearchRow>(
    `
      SELECT content, embedding <=> $1::vector AS distance
      FROM rag_document_chunks
      WHERE tenant_id = $2 AND owner_user_id = $3
      ORDER BY embedding <=> $1::vector
      LIMIT 2
    `,
    [queryEmbedding, tenantId, userId]
  );

  console.log("Top pgvector matches:");
  for (const row of searchResult.rows) {
    console.log(`- distance=${Number(row.distance).toFixed(4)} ${row.content}`);
  }

  try {
    await pool.query(
      `
        INSERT INTO rag_document_chunks (
          id,
          document_id,
          tenant_id,
          owner_user_id,
          chunk_index,
          content,
          embedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
      `,
      [randomUUID(), documentId, tenantId, userId, 99, "Wrong dimension", "[1,2,3]"]
    );
    throw new Error("Expected pgvector to reject the wrong embedding dimension");
  } catch (error) {
    if (error instanceof Error && /dimension/i.test(error.message)) {
      console.log("Dimension guard worked: pgvector rejected vector(3) for vector(4).");
    } else {
      throw error;
    }
  }
} finally {
  await pool.end();
}
