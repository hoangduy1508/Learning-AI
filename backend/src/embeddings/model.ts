import { createDeterministicEmbedding } from "./deterministic.js";

export interface EmbeddingBatch {
  texts: string[];
}

export interface EmbeddingModel {
  dimension: number;
  embedMany(batch: EmbeddingBatch): Promise<number[][]>;
}

export class DeterministicEmbeddingModel implements EmbeddingModel {
  constructor(readonly dimension: number) {}

  async embedMany(batch: EmbeddingBatch): Promise<number[][]> {
    return batch.texts.map((text) => createDeterministicEmbedding(text, this.dimension));
  }
}

export async function embedTextsInBatches(
  model: EmbeddingModel,
  texts: string[],
  batchSize: number
): Promise<number[][]> {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Embedding batch size must be a positive integer");
  }

  const embeddings: number[][] = [];
  for (let start = 0; start < texts.length; start += batchSize) {
    const batchEmbeddings = await model.embedMany({
      texts: texts.slice(start, start + batchSize)
    });
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}
