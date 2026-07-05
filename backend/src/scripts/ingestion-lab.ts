import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import { analyzeDocumentArtifacts } from "../ingestion/artifacts.js";
import { compareChunkingStrategies, createParentChildChunks } from "../ingestion/chunking.js";
import { cleanParsedDocument } from "../ingestion/clean.js";
import { parseSourceDocument } from "../ingestion/parser.js";
import { IngestionPipeline } from "../ingestion/pipeline.js";
import type { SourceDocument } from "../ingestion/types.js";
import { InMemoryIngestionVersionStore } from "../ingestion/versioning.js";
import { InMemoryVectorRepository } from "../vector/repository.js";

const repository = new InMemoryVectorRepository();
const versionStore = new InMemoryIngestionVersionStore();
const pipeline = new IngestionPipeline(repository, {
  embeddingDimension: 32,
  chunking: {
    maxCharacters: 220,
    overlapCharacters: 40
  },
  versionStore
});

const source: SourceDocument = {
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  title: "RAG ingestion notes",
  sourceUri: "memory://rag-ingestion-notes.pdf",
  mimeType: "application/pdf",
  content: [
    "AI Learning Handbook",
    "# Parsing",
    "RAG ingestion starts by parsing the source document and preserving page numbers.",
    "Metric | Owner | Status",
    "Parser | Platform | Green",
    "Cleaning removes noisy whitespace before chunking.",
    "---page---",
    "AI Learning Handbook",
    "# Chunking",
    "Chunking should keep enough context for retrieval while avoiding overly large prompts.",
    "Metric | Owner | Status",
    "Chunker | Search | Yellow",
    "Each chunk is embedded and indexed with metadata so citations can point back to pages."
  ].join("\n\n")
};

const parsed = parseSourceDocument(source);
const artifactReport = analyzeDocumentArtifacts(parsed);
const cleanedPages = cleanParsedDocument(parsed, { repeatedLineMinPages: 2 });
const comparisons = compareChunkingStrategies(cleanedPages, parsed.parser, {
  maxCharacters: 120,
  overlapCharacters: 24
});
const parentChild = createParentChildChunks(cleanedPages, parsed.parser, {
  parentMaxCharacters: 260,
  childMaxCharacters: 96,
  childOverlapCharacters: 24
});

const result = await pipeline.ingest(source);
const duplicateResult = await pipeline.ingest(source);
const changedResult = await pipeline.ingest({
  ...source,
  content: `${source.content}\n\nRe-indexing creates a new version when the checksum changes.`
});

const matches = await repository.searchTopK({
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  embedding: createDeterministicEmbedding("How do chunks keep page citations?", 32),
  topK: 2
});

console.log("Ingestion result");
console.log(JSON.stringify(result, null, 2));
console.log("\nRe-upload result");
console.log(JSON.stringify(duplicateResult, null, 2));
console.log("\nChanged document result");
console.log(JSON.stringify(changedResult, null, 2));
console.log("\nDocument artifact report");
console.log(JSON.stringify(artifactReport, null, 2));
console.log("\nChunking strategy comparison");
for (const comparison of comparisons) {
  const firstChunk = comparison.chunks[0];
  console.log(
    `- ${comparison.strategy}: chunks=${comparison.chunkCount} avgChars=${comparison.averageCharacters}` +
      (firstChunk?.metadata.sectionTitle ? ` firstSection=${firstChunk.metadata.sectionTitle}` : "")
  );
}
console.log(
  `- parent-child: parents=${parentChild.parents.length} children=${parentChild.children.length}` +
    ` firstChildParent=${String(parentChild.children[0]?.metadata.parentSectionTitle ?? "none")}`
);
console.log("\nTop matches");
for (const match of matches) {
  console.log(`- page=${String(match.metadata.page)} distance=${match.distance.toFixed(4)} ${match.content}`);
}
