import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createDeterministicEmbedding } from "../src/embeddings/deterministic.js";
import type { EmbeddingBatch } from "../src/embeddings/model.js";
import { analyzeDocumentArtifacts } from "../src/ingestion/artifacts.js";
import {
  chunkCleanedPages,
  chunkFixedSizePages,
  chunkStructureAwarePages,
  compareChunkingStrategies,
  createParentChildChunks
} from "../src/ingestion/chunking.js";
import { cleanParsedDocument, cleanText } from "../src/ingestion/clean.js";
import { parseSourceDocument, parseSourceDocumentAsync } from "../src/ingestion/parser.js";
import { InMemoryIngestionJobStore } from "../src/ingestion/jobs.js";
import { IngestionPipeline } from "../src/ingestion/pipeline.js";
import { InMemoryIngestionVersionStore } from "../src/ingestion/versioning.js";
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

  it("parses real PDF bytes and preserves page numbers", async () => {
    const parsed = await parseSourceDocumentAsync({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Real PDF",
      mimeType: "application/pdf",
      contentEncoding: "base64",
      content: createMinimalPdfBase64(["First page policy", "Second page citation"])
    });

    assert.equal(parsed.parser, "pdfjs");
    assert.deepEqual(
      parsed.pages.map((page) => page.pageNumber),
      [1, 2]
    );
    assert.match(parsed.pages[0]!.text, /First page policy/);
    assert.match(parsed.pages[1]!.text, /Second page citation/);
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

  it("embeds chunks in batches and tracks ingestion job status", async () => {
    const repository = new InMemoryVectorRepository();
    const jobStore = new InMemoryIngestionJobStore();
    const batchSizes: number[] = [];
    const pipeline = new IngestionPipeline(repository, {
      embeddingDimension: 8,
      embeddingBatchSize: 2,
      embeddingModel: {
        dimension: 8,
        async embedMany(batch: EmbeddingBatch) {
          batchSizes.push(batch.texts.length);
          return batch.texts.map((text) => createDeterministicEmbedding(text, 8));
        }
      },
      chunking: { maxCharacters: 24, overlapCharacters: 4 },
      jobStore
    });

    const result = await pipeline.ingest({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Batch guide",
      mimeType: "text/plain",
      content: "Alpha content. Beta content. Gamma content. Delta content."
    });

    assert.deepEqual(batchSizes, [2, 2]);
    assert.equal(result.embeddingBatchCount, 2);
    assert.ok(result.jobId);

    const job = await jobStore.findById(result.jobId!);
    assert.equal(job?.status, "indexed");
    assert.equal(job?.documentId, result.documentId);
  });

  it("marks ingestion jobs as failed when parsing or chunking fails", async () => {
    const repository = new InMemoryVectorRepository();
    const jobStore = new InMemoryIngestionJobStore();
    const pipeline = new IngestionPipeline(repository, {
      embeddingDimension: 8,
      chunking: { maxCharacters: 24, overlapCharacters: 4 },
      jobStore
    });

    await assert.rejects(
      pipeline.ingest({
        tenantId: "tenant_a",
        ownerUserId: "user_a",
        title: "Empty scanned PDF",
        mimeType: "application/pdf",
        content: " \n\n---page---\n\n "
      }),
      /Parsed PDF has no extractable text pages/
    );

    const failedJob = jobStore.list()[0];
    assert.equal(failedJob?.status, "failed");
    assert.equal(failedJob?.errorMessage, "Parsed PDF has no extractable text pages");
  });

  it("uses checksum and versioning to skip duplicate re-upload and index changed content", async () => {
    const repository = new InMemoryVectorRepository();
    const versionStore = new InMemoryIngestionVersionStore();
    const pipeline = new IngestionPipeline(repository, {
      embeddingDimension: 32,
      chunking: { maxCharacters: 160, overlapCharacters: 20 },
      versionStore
    });
    const source = {
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      title: "Versioned guide",
      sourceUri: "memory://guide.pdf",
      mimeType: "application/pdf" as const,
      content: "Initial retrieval policy."
    };

    const first = await pipeline.ingest(source);
    const duplicate = await pipeline.ingest(source);
    const changed = await pipeline.ingest({
      ...source,
      content: "Updated retrieval policy with re-indexing notes."
    });

    assert.equal(first.status, "indexed");
    assert.equal(first.version, 1);
    assert.equal(duplicate.status, "skipped_duplicate");
    assert.equal(duplicate.version, 1);
    assert.equal(duplicate.chunkCount, 0);
    assert.equal(changed.status, "indexed");
    assert.equal(changed.version, 2);
    assert.notEqual(changed.checksum, first.checksum);

    const matches = await repository.searchTopK({
      tenantId: "tenant_a",
      ownerUserId: "user_a",
      embedding: createDeterministicEmbedding("updated re-indexing notes", 32),
      topK: 5,
      metadata: { version: 2 }
    });

    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.metadata.version, 2);
    assert.equal(matches[0]?.metadata.sourceUri, "memory://guide.pdf");
  });
});

function createMinimalPdfBase64(pageTexts: string[]): string {
  const objects = new Map<number, string>();
  const fontObjectId = 3;
  const pageObjectIds = pageTexts.map((_, index) => 4 + index);
  const contentObjectIds = pageTexts.map((_, index) => 4 + pageTexts.length + index);

  objects.set(1, "<< /Type /Catalog /Pages 2 0 R >>");
  objects.set(
    2,
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${
      pageTexts.length
    } >>`
  );
  objects.set(fontObjectId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const [index, text] of pageTexts.entries()) {
    const pageObjectId = pageObjectIds[index]!;
    const contentObjectId = contentObjectIds[index]!;
    const stream = `BT /F1 24 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
    objects.set(
      pageObjectId,
      `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /MediaBox [0 0 612 792] /Contents ${contentObjectId} 0 R >>`
    );
    objects.set(contentObjectId, `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`);
  }

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const objectId of [...objects.keys()].sort((left, right) => left - right)) {
    offsets[objectId] = Buffer.byteLength(pdf, "ascii");
    pdf += `${objectId} 0 obj\n${objects.get(objectId)!}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  const objectCount = Math.max(...objects.keys()) + 1;
  pdf += `xref\n0 ${objectCount}\n`;
  pdf += "0000000000 65535 f \n";
  for (let objectId = 1; objectId < objectCount; objectId += 1) {
    pdf += `${String(offsets[objectId] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "ascii").toString("base64");
}

function escapePdfText(text: string): string {
  return text.replace(/[\\()]/g, (match) => `\\${match}`);
}
