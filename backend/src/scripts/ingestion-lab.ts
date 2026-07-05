import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import { IngestionPipeline } from "../ingestion/pipeline.js";
import { InMemoryVectorRepository } from "../vector/repository.js";

const repository = new InMemoryVectorRepository();
const pipeline = new IngestionPipeline(repository, {
  embeddingDimension: 32,
  chunking: {
    maxCharacters: 220,
    overlapCharacters: 40
  }
});

const result = await pipeline.ingest({
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  title: "RAG ingestion notes",
  sourceUri: "memory://rag-ingestion-notes.pdf",
  mimeType: "application/pdf",
  content: [
    "RAG ingestion starts by parsing the source document and preserving page numbers.",
    "Cleaning removes noisy whitespace before chunking.",
    "---page---",
    "Chunking should keep enough context for retrieval while avoiding overly large prompts.",
    "Each chunk is embedded and indexed with metadata so citations can point back to pages."
  ].join("\n\n")
});

const matches = await repository.searchTopK({
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  embedding: createDeterministicEmbedding("How do chunks keep page citations?", 32),
  topK: 2
});

console.log("Ingestion result");
console.log(JSON.stringify(result, null, 2));
console.log("\nTop matches");
for (const match of matches) {
  console.log(`- page=${String(match.metadata.page)} distance=${match.distance.toFixed(4)} ${match.content}`);
}
