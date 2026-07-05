import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDeterministicEmbedding } from "../src/embeddings/deterministic.js";
import {
  chunkCleanedPages,
  chunkFixedSizePages,
  chunkStructureAwarePages,
  compareChunkingStrategies
} from "../src/ingestion/chunking.js";
import { cleanText } from "../src/ingestion/clean.js";
import { parseSourceDocument } from "../src/ingestion/parser.js";
import { IngestionPipeline } from "../src/ingestion/pipeline.js";
import { InMemoryVectorRepository } from "../src/vector/repository.js";

describe("ingestion pipeline", () => {
  it("parses PDF text pages and preserves page numbers", () => {
    const parsed = parseSourceDocument({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Guide",
      mimeType: "application/pdf",
      content: "Page one text\n\n---page---\n\nPage two text"
    });

    assert.equal(parsed.parser, "pdf-text-pages");
    assert.deepEqual(
      parsed.pages.map((page) => page.pageNumber),
      [1, 2]
    );
  });

  it("cleans noisy whitespace before chunking", () => {
    assert.equal(cleanText(" Hello   world \r\n\r\n\r\n next  line \t\n"), "Hello world\n\n next line");
  });

  it("splits long pages with bounded overlap and page metadata", () => {
    const chunks = chunkCleanedPages(
      [
        {
          pageNumber: 3,
          originalLength: 210,
          text: "Alpha sentence. Beta sentence. Gamma sentence. Delta sentence. Epsilon sentence."
        }
      ],
      "plain-text",
      { maxCharacters: 35, overlapCharacters: 8 }
    );

    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.metadata.page === 3));
    assert.ok(chunks.every((chunk) => chunk.content.length <= 43));
  });

  it("compares fixed-size, recursive, and structure-aware chunking", () => {
    const pages = [
      {
        pageNumber: 1,
        originalLength: 180,
        text: [
          "# Billing",
          "Billing policy explains invoices and refunds.",
          "",
          "# Security",
          "Security policy explains tenant isolation and audit logs."
        ].join("\n")
      }
    ];

    const fixed = chunkFixedSizePages(pages, "plain-text", {
      maxCharacters: 48,
      overlapCharacters: 8
    });
    const recursive = chunkCleanedPages(pages, "plain-text", {
      maxCharacters: 48,
      overlapCharacters: 8
    });
    const structured = chunkStructureAwarePages(pages, "plain-text", {
      maxCharacters: 80,
      overlapCharacters: 8
    });

    assert.equal(fixed[0]?.metadata.chunking, "fixed-size");
    assert.equal(recursive[0]?.metadata.chunking, "recursive-text");
    assert.deepEqual(
      structured.map((chunk) => chunk.metadata.sectionTitle),
      ["Billing", "Security"]
    );

    const comparison = compareChunkingStrategies(pages, "plain-text", {
      maxCharacters: 60,
      overlapCharacters: 8
    });
    assert.deepEqual(
      comparison.map((entry) => entry.strategy),
      ["fixed-size", "recursive-text", "structure-aware"]
    );
    assert.ok(comparison.every((entry) => entry.chunkCount > 0));
  });

  it("parses, cleans, chunks, embeds, and indexes a document", async () => {
    const repository = new InMemoryVectorRepository();
    const pipeline = new IngestionPipeline(repository, {
      embeddingDimension: 32,
      chunking: { maxCharacters: 120, overlapCharacters: 20 }
    });

    const result = await pipeline.ingest({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "RAG notes",
      sourceUri: "memory://rag-notes.pdf",
      mimeType: "application/pdf",
      content: [
        "Parsing extracts text and page numbers for citation.",
        "---page---",
        "Chunking creates retrievable passages. Embedding indexes each chunk."
      ].join("\n\n")
    });

    assert.equal(result.pageCount, 2);
    assert.equal(result.chunkCount, 2);

    const matches = await repository.searchTopK({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      embedding: createDeterministicEmbedding("How are chunks indexed?", 32),
      topK: 2
    });

    assert.equal(matches.length, 2);
    assert.ok(matches.every((match) => typeof match.metadata.page === "number"));
  });
});
