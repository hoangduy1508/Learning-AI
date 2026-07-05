import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  cosineDistance,
  cosineSimilarity,
  createDeterministicEmbedding,
  dotProduct,
  formatVectorLiteral,
  l2Distance
} from "../src/embeddings/deterministic.js";
import { pgvectorDimension, pgvectorSchemaSql } from "../src/vector/schema.js";

describe("embedding and pgvector basics", () => {
  it("creates deterministic embeddings with a fixed dimension", () => {
    const first = createDeterministicEmbedding("Postgres vector search", 4);
    const second = createDeterministicEmbedding("Postgres vector search", 4);

    assert.equal(first.length, 4);
    assert.deepEqual(first, second);
    assert.match(formatVectorLiteral(first), /^\[-?\d/);
  });

  it("rejects vector math across different dimensions", () => {
    assert.throws(() => cosineSimilarity([1, 0], [1, 0, 0]), /dimension mismatch/i);
  });

  it("calculates cosine, dot product, and L2 relationships", () => {
    const left = [1, 0];
    const right = [0, 1];
    const same = [1, 0];

    assert.equal(dotProduct(left, right), 0);
    assert.equal(cosineSimilarity(left, same), 1);
    assert.equal(cosineDistance(left, same), 0);
    assert.equal(cosineSimilarity(left, right), 0);
    assert.equal(cosineDistance(left, right), 1);
    assert.equal(Number(l2Distance(left, right).toFixed(4)), 1.4142);
  });

  it("declares pgvector schema with tenant filtering and vector dimension", () => {
    assert.equal(pgvectorDimension, 4);
    assert.match(pgvectorSchemaSql, /CREATE EXTENSION IF NOT EXISTS vector/);
    assert.match(pgvectorSchemaSql, /embedding vector\(4\) NOT NULL/);
    assert.match(pgvectorSchemaSql, /tenant_id text NOT NULL/);
    assert.match(pgvectorSchemaSql, /owner_user_id text NOT NULL/);
    assert.match(pgvectorSchemaSql, /USING hnsw \(embedding vector_cosine_ops\)/);
  });
});
