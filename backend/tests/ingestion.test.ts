import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDeterministicEmbedding } from "../src/embeddings/deterministic.js";
import { analyzeDocumentArtifacts } from "../src/ingestion/artifacts.js";
import {
  chunkCleanedPages,
  chunkFixedSizePages,
  chunkStructureAwarePages,
  compareChunkingStrategies,
  createParentChildChunks
} from "../src/ingestion/chunking.js";
import { cleanParsedDocument, cleanText } from "../src/ingestion/clean.js";
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

  it("detects tables and repeated headers or footers in parsed documents", () => {
    const parsed = parseSourceDocument({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Policy PDF",
      mimeType: "application/pdf",
      content: [
        "Company Confidential",
        "Metric | Owner | Status",
        "Latency | Platform | Green",
        "Page 1",
        "---page---",
        "Company Confidential",
        "Metric | Owner | Status",
        "Cost | Finance | Yellow",
        "Page 2"
      ].join("\n")
    });

    const report = analyzeDocumentArtifacts(parsed);
    assert.equal(report.scannedPdfLikely, false);
    assert.equal(report.tableLikeLineCount, 4);
    assert.deepEqual(report.repeatedLines.sort(), ["Company Confidential", "Metric | Owner | Status"]);

    const cleaned = cleanParsedDocument(parsed, { repeatedLineMinPages: 2 });
    assert.ok(cleaned.every((page) => !page.text.includes("Company Confidential")));
    assert.ok(cleaned.every((page) => !page.text.includes("Metric | Owner | Status")));
  });

  it("treats PDF pages without extractable text as a likely scanned document", () => {
    const report = analyzeDocumentArtifacts({
      title: "Scanned PDF",
      parser: "pdf-text-pages",
      pages: [
        { pageNumber: 1, text: " \n \t " },
        { pageNumber: 2, text: "\n" }
      ]
    });

    assert.equal(report.hasExtractableText, false);
    assert.equal(report.scannedPdfLikely, true);
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

  it("creates parent-child chunks with child overlap and parent metadata", () => {
    const pages = [
      {
        pageNumber: 2,
        originalLength: 220,
        text: [
          "# Security",
          "Tenant filters must run before vector ranking.",
          "Audit logs record retrieval and tool activity.",
          "Prompt injection text from documents stays untrusted."
        ].join("\n")
      }
    ];

    const result = createParentChildChunks(pages, "plain-text", {
      parentMaxCharacters: 220,
      childMaxCharacters: 72,
      childOverlapCharacters: 24
    });

    assert.equal(result.parents.length, 1);
    assert.ok(result.children.length > 1);
    assert.ok(result.children.every((chunk) => chunk.metadata.chunking === "parent-child-child"));
    assert.ok(result.children.every((chunk) => chunk.metadata.parentChunkIndex === 0));
    assert.ok(result.children.every((chunk) => chunk.metadata.parentSectionTitle === "Security"));
    assert.ok(result.children.every((chunk) => chunk.metadata.childOverlapCharacters === 24));
    assert.equal(result.parents[0]?.metadata.chunking, "parent-child-parent");

    const firstChildTail = result.children[0]!.content.slice(-16);
    assert.ok(result.children[1]!.content.includes(firstChildTail));
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
