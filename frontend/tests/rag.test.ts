import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { evaluateRag, queryRag, uploadRagDocument } from "../src/api/rag";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("rag api", () => {
  it("uploads documents for ingestion", async () => {
    globalThis.fetch = async (input, init) => {
      assert.equal(input, "/api/ingestion/upload");
      assert.equal(init?.method, "POST");
      return Response.json({
        file_name: "guide.txt",
        mime_type: "text/plain",
        size_bytes: 12,
        document_id: "doc_1",
        chunk_count: 1,
        page_count: 1,
        checksum: "checksum",
        version: 1,
        status: "indexed",
        embedding_batch_count: 1
      });
    };

    const result = await uploadRagDocument({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Guide",
      sourceUri: "memory://guide.txt",
      fileName: "guide.txt",
      mimeType: "text/plain",
      contentEncoding: "utf8",
      content: "hello"
    });

    assert.equal(result.document_id, "doc_1");
  });

  it("queries RAG answers", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/rag/query");
      return Response.json({
        status: "answered",
        answer: "Evidence",
        contexts: [],
        citations: []
      });
    };

    const result = await queryRag({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      query: "question",
      strategy: "hybrid",
      topK: 3,
      similarityThreshold: 0.05
    });

    assert.equal(result.status, "answered");
  });

  it("runs RAG evaluation", async () => {
    globalThis.fetch = async (input) => {
      assert.equal(input, "/api/rag/evaluate");
      return Response.json({
        caseCount: 1,
        retrievalRecall: 1,
        answerCorrectness: 1,
        citationCorrectness: 1,
        report: "ok"
      });
    };

    const result = await evaluateRag({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      strategy: "hybrid",
      topK: 3,
      similarityThreshold: 0.05,
      cases: [
        {
          id: "case_1",
          question: "question",
          expectedAnswerContains: ["answer"],
          expectedDocumentId: "doc_1",
          expectedPageNumber: 1
        }
      ]
    });

    assert.equal(result.citationCorrectness, 1);
  });
});
