import type { CleanedPage, DocumentChunk, ParsedDocument } from "./types.js";

export interface RecursiveChunkOptions {
  maxCharacters: number;
  overlapCharacters: number;
}

export function chunkCleanedPages(
  pages: CleanedPage[],
  parser: ParsedDocument["parser"],
  options: RecursiveChunkOptions
): DocumentChunk[] {
  if (options.maxCharacters <= 0) {
    throw new Error("maxCharacters must be positive");
  }
  if (options.overlapCharacters < 0 || options.overlapCharacters >= options.maxCharacters) {
    throw new Error("overlapCharacters must be smaller than maxCharacters");
  }

  const chunks: DocumentChunk[] = [];
  for (const page of pages) {
    for (const content of splitRecursive(page.text, options)) {
      chunks.push({
        chunkIndex: chunks.length,
        pageNumber: page.pageNumber,
        content,
        metadata: {
          page: page.pageNumber,
          parser,
          chunking: "recursive-text",
          tokenEstimate: estimateTokens(content)
        }
      });
    }
  }
  return chunks;
}

function splitRecursive(text: string, options: RecursiveChunkOptions): string[] {
  if (text.length <= options.maxCharacters) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > options.maxCharacters) {
    const splitAt = chooseSplitIndex(remaining, options.maxCharacters);
    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    const nextStart = Math.max(0, splitAt - options.overlapCharacters);
    remaining = remaining.slice(nextStart).trimStart();
  }

  if (remaining.trim().length > 0) {
    chunks.push(remaining.trim());
  }

  return chunks;
}

function chooseSplitIndex(text: string, maxCharacters: number): number {
  const candidates = ["\n\n", "\n", ". ", " "];
  const window = text.slice(0, maxCharacters + 1);

  for (const separator of candidates) {
    const index = window.lastIndexOf(separator);
    if (index >= Math.floor(maxCharacters * 0.45)) {
      return index + separator.length;
    }
  }

  return maxCharacters;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
