export type RetrievalStrategy = "semantic" | "keyword" | "hybrid";

export interface RagUploadRequest {
  tenantId: string;
  ownerUserId: string;
  title: string;
  sourceUri: string;
  fileName: string;
  mimeType: "text/plain" | "application/pdf";
  contentEncoding: "utf8" | "base64";
  content: string;
}

export interface RagUploadResult {
  file_name: string;
  mime_type: string;
  size_bytes: number;
  document_id: string;
  job_id?: string;
  chunk_count: number;
  page_count: number;
  checksum: string;
  version: number;
  status: "indexed" | "skipped_duplicate";
  embedding_batch_count: number;
}

export interface RagCitation {
  chunkId: string;
  documentId: string;
  pageNumber?: number;
  sourceUri?: string;
}

export interface RagContext {
  chunkId: string;
  documentId: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  semanticScore?: number;
  keywordScore?: number;
  citation: RagCitation;
}

export interface RagQueryResult {
  status: "answered" | "refused";
  answer: string;
  contexts: RagContext[];
  citations: RagCitation[];
}

export interface RagEvaluationCase {
  id: string;
  question: string;
  expectedAnswerContains: string[];
  expectedDocumentId: string;
  expectedPageNumber: number;
}

export interface RagEvaluationResult {
  caseCount: number;
  retrievalRecall: number;
  answerCorrectness: number;
  citationCorrectness: number;
  report: string;
}

export async function uploadRagDocument(input: RagUploadRequest): Promise<RagUploadResult> {
  return await requestJson<RagUploadResult>("/api/ingestion/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function queryRag(input: {
  tenantId: string;
  ownerUserId: string;
  query: string;
  strategy: RetrievalStrategy;
  topK: number;
  similarityThreshold: number;
  metadata?: Record<string, string | number | boolean>;
}): Promise<RagQueryResult> {
  return await requestJson<RagQueryResult>("/api/rag/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
}

export async function evaluateRag(input: {
  tenantId: string;
  ownerUserId: string;
  strategy: RetrievalStrategy;
  topK: number;
  similarityThreshold: number;
  cases: RagEvaluationCase[];
}): Promise<RagEvaluationResult> {
  return await requestJson<RagEvaluationResult>("/api/rag/evaluate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
