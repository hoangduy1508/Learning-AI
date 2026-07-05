import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import { compareChunkingStrategies } from "../ingestion/chunking.js";
import { cleanParsedDocument } from "../ingestion/clean.js";
import { parseSourceDocument } from "../ingestion/parser.js";
import { IngestionPipeline } from "../ingestion/pipeline.js";
import type { SourceDocument } from "../ingestion/types.js";
import { InMemoryVectorRepository } from "../vector/repository.js";

const repository = new InMemoryVectorRepository();
const pipeline = new IngestionPipeline(repository, {
  embeddingDimension: 32,
  chunking: {
    maxCharacters: 220,
    overlapCharacters: 40
  }
});

const source: SourceDocument = {
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  title: "RAG ingestion notes",
  sourceUri: "memory://rag-ingestion-notes.pdf",
  mimeType: "application/pdf",
  content: [
    "# Parsing",
    "RAG ingestion starts by parsing the source document and preserving page numbers.",
    "Cleaning removes noisy whitespace before chunking.",
    "---page---",
    "# Chunking",
    "Chunking should keep enough context for retrieval while avoiding overly large prompts.",
    "Each chunk is embedded and indexed with metadata so citations can point back to pages."
  ].join("\n\n")
};

const parsed = parseSourceDocument(source);
const cleanedPages = cleanParsedDocument(parsed);
const comparisons = compareChunkingStrategies(cleanedPages, parsed.parser, {
  maxCharacters: 120,
  overlapCharacters: 24
});

const result = await pipeline.ingest(source);

const matches = await repository.searchTopK({
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  embedding: createDeterministicEmbedding("How do chunks keep page citations?", 32),
  topK: 2
});

console.log("Ingestion result");
console.log(JSON.stringify(result, null, 2));
console.log("\nChunking strategy comparison");
for (const comparison of comparisons) {
  const firstChunk = comparison.chunks[0];
  console.log(
    `- ${comparison.strategy}: chunks=${comparison.chunkCount} avgChars=${comparison.averageCharacters}` +
      (firstChunk?.metadata.sectionTitle ? ` firstSection=${firstChunk.metadata.sectionTitle}` : "")
  );
}
console.log("\nTop matches");
for (const match of matches) {
  console.log(`- page=${String(match.metadata.page)} distance=${match.distance.toFixed(4)} ${match.content}`);
}
