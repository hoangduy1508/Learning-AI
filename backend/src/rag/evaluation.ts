import type { RagRetrievalPipeline, RetrievalStrategy } from "./retrieval.js";

export interface RagEvaluationCase {
  id: string;
  question: string;
  expectedAnswerContains: string[];
  expectedDocumentId: string;
  expectedPageNumber: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface RagEvaluationResult {
  caseCount: number;
  retrievalRecall: number;
  answerCorrectness: number;
  citationCorrectness: number;
}

export async function evaluateRagPipeline(
  pipeline: RagRetrievalPipeline,
  cases: RagEvaluationCase[],
  options: {
    tenantId: string;
    ownerUserId: string;
    strategy: RetrievalStrategy;
    topK: number;
    similarityThreshold?: number;
  }
): Promise<RagEvaluationResult> {
  let retrievedExpected = 0;
  let answerCorrect = 0;
  let citationCorrect = 0;

  for (const testCase of cases) {
    const answer = await pipeline.answerWithCitations({
      tenantId: options.tenantId,
      ownerUserId: options.ownerUserId,
      query: testCase.question,
      topK: options.topK,
      similarityThreshold: options.similarityThreshold,
      metadata: testCase.metadata,
      strategy: options.strategy
    });
    const foundExpected = answer.contexts.some(
      (context) =>
        context.documentId === testCase.expectedDocumentId &&
        context.citation.pageNumber === testCase.expectedPageNumber
    );
    if (foundExpected) {
      retrievedExpected += 1;
    }

    const lowerAnswer = answer.answer.toLowerCase();
    if (
      answer.status === "answered" &&
      testCase.expectedAnswerContains.every((term) => lowerAnswer.includes(term.toLowerCase()))
    ) {
      answerCorrect += 1;
    }

    if (
      answer.citations.some(
        (citation) =>
          citation.documentId === testCase.expectedDocumentId &&
          citation.pageNumber === testCase.expectedPageNumber
      )
    ) {
      citationCorrect += 1;
    }
  }

  return {
    caseCount: cases.length,
    retrievalRecall: ratio(retrievedExpected, cases.length),
    answerCorrectness: ratio(answerCorrect, cases.length),
    citationCorrectness: ratio(citationCorrect, cases.length)
  };
}

export function buildEvaluationReport(strategy: RetrievalStrategy, result: RagEvaluationResult): string {
  return [
    `# RAG Evaluation Report`,
    ``,
    `- Strategy: ${strategy}`,
    `- Cases: ${result.caseCount}`,
    `- Retrieval recall: ${formatPercent(result.retrievalRecall)}`,
    `- Answer correctness: ${formatPercent(result.answerCorrectness)}`,
    `- Citation correctness: ${formatPercent(result.citationCorrectness)}`
  ].join("\n");
}

function ratio(value: number, total: number): number {
  return total === 0 ? 0 : value / total;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
