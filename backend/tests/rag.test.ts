import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDeterministicEmbedding } from "../src/embeddings/deterministic.js";
import {
  buildEvaluationReport,
  evaluateRagPipeline,
  type RagEvaluationCase
} from "../src/rag/evaluation.js";
import { RagRetrievalPipeline } from "../src/rag/retrieval.js";
import { InMemoryVectorRepository } from "../src/vector/repository.js";

describe("RAG retrieval and evaluation", () => {
  it("retrieves with metadata filters and returns page citations", async () => {
    const { pipeline, documentId } = await createPolicyRagPipeline();

    const answer = await pipeline.answerWithCitations({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      query: "What does the refund policy say about invoices?",
      topK: 2,
      strategy: "hybrid",
      metadata: { version: 1 },
      similarityThreshold: 0.05
    });

    assert.equal(answer.status, "answered");
    assert.equal(answer.citations[0]?.documentId, documentId);
    assert.equal(answer.citations[0]?.pageNumber, 2);
    assert.match(answer.answer, /refund/i);
  });

  it("refuses to answer when retrieved evidence is below threshold", async () => {
    const { pipeline } = await createPolicyRagPipeline();

    const answer = await pipeline.answerWithCitations({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      query: "How do I configure Kubernetes autoscaling?",
      topK: 2,
      strategy: "semantic",
      similarityThreshold: 0.99
    });

    assert.equal(answer.status, "refused");
    assert.equal(answer.contexts.length, 0);
    assert.match(answer.answer, /Không đủ bằng chứng/);
  });

  it("evaluates retrieval recall, answer correctness, and citation correctness", async () => {
    const { pipeline, documentId } = await createPolicyRagPipeline();
    const cases: RagEvaluationCase[] = [
      {
        id: "q1",
        question: "Where is tenant isolation explained?",
        expectedAnswerContains: ["tenant isolation"],
        expectedDocumentId: documentId,
        expectedPageNumber: 1
      },
      {
        id: "q2",
        question: "Which page mentions refunds?",
        expectedAnswerContains: ["refund"],
        expectedDocumentId: documentId,
        expectedPageNumber: 2
      }
    ];

    const result = await evaluateRagPipeline(pipeline, cases, {
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      strategy: "hybrid",
      topK: 2,
      similarityThreshold: 0.05
    });

    assert.equal(result.caseCount, 2);
    assert.equal(result.retrievalRecall, 1);
    assert.equal(result.answerCorrectness, 1);
    assert.equal(result.citationCorrectness, 1);
    assert.match(buildEvaluationReport("hybrid", result), /Citation correctness: 100%/);
  });
});

async function createPolicyRagPipeline() {
  const repository = new InMemoryVectorRepository();
  const documentId = await repository.createDocument({
    id: "doc_policy",
    tenantId: "tenant_a",
    ownerUserId: "user_a",
    title: "Policy Guide",
    sourceUri: "memory://policy.pdf"
  });

  const chunks = [
    {
      content: "Tenant isolation requires filtering by tenant and owner before vector ranking.",
      page: 1
    },
    {
      content: "Refund policy requires an invoice number and cites the billing document.",
      page: 2
    },
    {
      content: "Audit logs record retrieval queries, citations, and tool calls.",
      page: 3
    }
  ];

  for (const [index, chunk] of chunks.entries()) {
    await repository.insertChunk({
      id: `chunk_${index + 1}`,
      documentId,
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      chunkIndex: index,
      content: chunk.content,
      metadata: {
        page: chunk.page,
        sourceUri: "memory://policy.pdf",
        version: 1
      },
      embedding: createDeterministicEmbedding(chunk.content, 32)
    });
  }

  return {
    documentId,
    pipeline: new RagRetrievalPipeline(repository, { embeddingDimension: 32 })
  };
}
