import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import {
  buildEvaluationReport,
  evaluateRagPipeline,
  type RagEvaluationCase
} from "../rag/evaluation.js";
import { RagRetrievalPipeline, type RetrievalStrategy } from "../rag/retrieval.js";
import { InMemoryVectorRepository } from "../vector/repository.js";

const repository = new InMemoryVectorRepository();
const documentId = await repository.createDocument({
  id: "doc_secure_rag",
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  title: "Secure RAG Handbook",
  sourceUri: "memory://secure-rag-handbook.pdf"
});

const chunks = [
  ["Chunking keeps page trace for citation.", 1],
  ["Tenant isolation filters tenant and owner before vector ranking.", 2],
  ["Hybrid search combines semantic vectors with keyword evidence.", 3],
  ["Similarity threshold refuses answers when evidence is too weak.", 4],
  ["Reranking reorders retrieved candidates with a stronger relevance model.", 5],
  ["Retrieval quality measures whether the right evidence was found.", 6],
  ["Generation quality measures whether the final answer is faithful and useful.", 7],
  ["Query rewriting creates a clearer search query from the user question.", 8],
  ["Multi-query retrieval searches several paraphrases and merges candidates.", 9],
  ["Citation correctness checks that the cited page contains the claimed evidence.", 10]
] as const;

for (const [index, [content, page]] of chunks.entries()) {
  await repository.insertChunk({
    id: `secure_rag_chunk_${index + 1}`,
    documentId,
    tenantId: "tenant_demo",
    ownerUserId: "user_demo",
    chunkIndex: index,
    content,
    metadata: {
      page,
      sourceUri: "memory://secure-rag-handbook.pdf",
      version: 1
    },
    embedding: createDeterministicEmbedding(content, 32)
  });
}

const cases: RagEvaluationCase[] = Array.from({ length: 30 }, (_, index) => {
  const [content, page] = chunks[index % chunks.length]!;
  const keyword = content.split(" ")[0]!;
  return {
    id: `rag_eval_${index + 1}`,
    question: `What does the handbook say about ${keyword.toLowerCase()}?`,
    expectedAnswerContains: [keyword],
    expectedDocumentId: documentId,
    expectedPageNumber: page
  };
});

const pipeline = new RagRetrievalPipeline(repository, { embeddingDimension: 32 });
for (const strategy of ["semantic", "keyword", "hybrid"] satisfies RetrievalStrategy[]) {
  const result = await evaluateRagPipeline(pipeline, cases, {
    tenantId: "tenant_demo",
    ownerUserId: "user_demo",
    strategy,
    topK: 3,
    similarityThreshold: strategy === "semantic" ? 0 : 0.05
  });
  console.log(buildEvaluationReport(strategy, result));
  console.log("");
}

const answer = await pipeline.answerWithCitations({
  tenantId: "tenant_demo",
  ownerUserId: "user_demo",
  query: "How does hybrid search work?",
  topK: 3,
  strategy: "hybrid",
  similarityThreshold: 0.05
});
console.log("Sample grounded answer");
console.log(JSON.stringify(answer, null, 2));
