import { createHash } from "node:crypto";

export function createDeterministicEmbedding(text: string, dimension: number): number[] {
  if (!Number.isInteger(dimension) || dimension <= 0) {
    throw new Error("Embedding dimension must be a positive integer");
  }

  const vector = Array.from({ length: dimension }, () => 0);
  const tokens = text.toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    const index = digest.readUInt32BE(0) % dimension;
    const sign = digest[4] % 2 === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return normalizeVector(vector);
}

export function cosineSimilarity(left: number[], right: number[]): number {
  assertSameDimension(left, right);
  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);
  if (leftMagnitude === 0 || rightMagnitude === 0) {
    return 0;
  }
  return dotProduct(left, right) / (leftMagnitude * rightMagnitude);
}

export function cosineDistance(left: number[], right: number[]): number {
  return 1 - cosineSimilarity(left, right);
}

export function dotProduct(left: number[], right: number[]): number {
  assertSameDimension(left, right);
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

export function l2Distance(left: number[], right: number[]): number {
  assertSameDimension(left, right);
  const squaredDistance = left.reduce((sum, value, index) => {
    const delta = value - (right[index] ?? 0);
    return sum + delta * delta;
  }, 0);
  return Math.sqrt(squaredDistance);
}

export function formatVectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => Number(value.toFixed(6))).join(",")}]`;
}

function normalizeVector(vector: number[]): number[] {
  const vectorMagnitude = magnitude(vector);
  if (vectorMagnitude === 0) {
    return vector;
  }
  return vector.map((value) => value / vectorMagnitude);
}

function magnitude(vector: number[]): number {
  return Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
}

function assertSameDimension(left: number[], right: number[]) {
  if (left.length !== right.length) {
    throw new Error(`Vector dimension mismatch: ${left.length} !== ${right.length}`);
  }
}
