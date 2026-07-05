import type { ParsedDocument } from "./types.js";

export interface DocumentArtifactReport {
  pageCount: number;
  hasExtractableText: boolean;
  scannedPdfLikely: boolean;
  tableLikeLineCount: number;
  repeatedLines: string[];
}

export function analyzeDocumentArtifacts(document: ParsedDocument): DocumentArtifactReport {
  const pageTexts = document.pages.map((page) => page.text);
  const repeatedLines = findRepeatedLines(pageTexts, 2);
  const tableLikeLineCount = pageTexts.reduce(
    (count, text) => count + text.split(/\r?\n/).filter(isTableLikeLine).length,
    0
  );
  const totalExtractedCharacters = pageTexts.reduce(
    (sum, text) => sum + text.replace(/\s/g, "").length,
    0
  );

  return {
    pageCount: document.pages.length,
    hasExtractableText: totalExtractedCharacters > 0,
    scannedPdfLikely: document.parser === "pdf-text-pages" && totalExtractedCharacters === 0,
    tableLikeLineCount,
    repeatedLines
  };
}

function findRepeatedLines(texts: string[], minPages: number): string[] {
  const counts = new Map<string, number>();
  for (const text of texts) {
    const uniqueLines = new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    );

    for (const line of uniqueLines) {
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= minPages)
    .map(([line]) => line);
}

function isTableLikeLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return false;
  }

  const pipeCells = trimmed.split("|").filter((cell) => cell.trim().length > 0);
  const spacedCells = trimmed.split(/\s{2,}/).filter((cell) => cell.trim().length > 0);
  return pipeCells.length >= 3 || spacedCells.length >= 3;
}
