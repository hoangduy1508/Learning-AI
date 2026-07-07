import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import type {
  KeywordSearchMatch,
  VectorRepository,
  VectorSearchMatch
} from "../vector/repository.js";

export type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

export interface RetrievalRequest {
  tenantId: string;
  ownerUserId: string;
  query: string;
  topK: number;
  similarityThreshold?: number;
  metadata?: Record<string, string | number | boolean>;
  strategy: RetrievalStrategy;
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  pageNumber?: number;
  sourceUri?: string;
}

export interface RetrievedContext {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  citation: RagCitation;
}

export interface RagAnswer {
  status: "answered" | "refused";
  answer: string;
  contexts: RetrievedContext[];
  citations: RagCitation[];
}

export class RagRetrievalPipeline {
  constructor(
    private readonly repository: VectorRepository,
    private readonly options: { embeddingDimension: number }
  ) {}

  async retrieve(request: RetrievalRequest): Promise<RetrievedContext[]> {
    const threshold = request.similarityThreshold ?? 0;
    const semantic =
      request.strategy === "keyword"
        ? []
        : await this.repository.searchTopK({
            tenantId: request.tenantId,
            ownerUserId: request.ownerUserId,
            embedding: createDeterministicEmbedding(request.query, this.options.embeddingDimension),
            topK: Math.max(request.topK * 3, request.topK),
            metadata: request.metadata
          });
    const keyword =
      request.strategy === "semantic"
        ? []
        : await this.repository.searchKeyword({
            tenantId: request.tenantId,
            ownerUserId: request.ownerUserId,
            query: request.query,
            topK: Math.max(request.topK * 3, request.topK),
            metadata: request.metadata
          });

    const merged = mergeMatches(semantic, keyword, request.strategy)
      .filter((context) => context.score >= threshold)
      .sort((left, right) => right.score - left.score)
      .slice(0, request.topK);

    return merged;
  }

  async answerWithCitations(request: RetrievalRequest): Promise<RagAnswer> {
    const contexts = await this.retrieve(request);
    if (contexts.length === 0) {
      return {
        status: "refused",
        answer: "Không đủ bằng chứng trong tài liệu đã truy xuất để trả lời câu hỏi này.",
        contexts: [],
        citations: []
      };
    }

    return {
      status: "answered",
      answer: buildGroundedAnswer(request.query, contexts),
      contexts,
      citations: contexts.map((context) => context.citation)
    };
  }
}

function mergeMatches(
  semanticMatches: VectorSearchMatch[],
  keywordMatches: KeywordSearchMatch[],
  strategy: RetrievalStrategy
): RetrievedContext[] {
  const byChunkId = new Map<string, RetrievedContext>();
  const maxKeywordScore = Math.max(...keywordMatches.map((match) => match.score), 1);

  for (const match of semanticMatches) {
    const semanticScore = Math.max(0, 1 - match.distance);
    byChunkId.set(match.id, toRetrievedContext(match, {
      score: strategy === "semantic" ? semanticScore : semanticScore * 0.7,
      semanticScore
    }));
  }

  for (const match of keywordMatches) {
    const keywordScore = match.score / maxKeywordScore;
    const existing = byChunkId.get(match.id);
    if (existing) {
      existing.keywordScore = keywordScore;
      existing.score =
        strategy === "hybrid"
          ? (existing.semanticScore ?? 0) * 0.7 + keywordScore * 0.3
          : keywordScore;
      continue;
    }

    byChunkId.set(match.id, toRetrievedContext(match, {
      score: strategy === "keyword" ? keywordScore : keywordScore * 0.3,
      keywordScore
    }));
  }

  return [...byChunkId.values()];
}

function toRetrievedContext(
  match: VectorSearchMatch | KeywordSearchMatch,
  scores: { score: number; semanticScore?: number; keywordScore?: number }
): RetrievedContext {
  return {
    chunkId: match.id,
    documentId: match.documentId,
    content: match.content,
    metadata: match.metadata,
    ...scores,
    citation: {
      chunkId: match.id,
      documentId: match.documentId,
      pageNumber: typeof match.metadata.page === "number" ? match.metadata.page : undefined,
      sourceUri: typeof match.metadata.sourceUri === "string" ? match.metadata.sourceUri : undefined
    }
  };
}

function buildGroundedAnswer(query: string, contexts: RetrievedContext[]): string {
  const evidence = contexts
    .map((context, index) => {
      const page = context.citation.pageNumber ? `trang ${context.citation.pageNumber}` : "không rõ trang";
      return `[${index + 1}] ${page}: ${context.content}`;
    })
    .join("\n");
  return `Câu hỏi: ${query}\n\nCâu trả lời dựa trên bằng chứng truy xuất:\n${evidence}`;
}
