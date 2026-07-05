import type { CleanedPage, ParsedDocument } from "./types.js";

export interface CleanDocumentOptions {
  repeatedLineMinPages?: number;
}

export function cleanParsedDocument(
  document: ParsedDocument,
  options: CleanDocumentOptions = {}
): CleanedPage[] {
  const repeatedLines = findRepeatedPageLines(
    document.pages.map((page) => page.text),
    options.repeatedLineMinPages ?? 0
  );

  return document.pages
    .map((page) => ({
      pageNumber: page.pageNumber,
      originalLength: page.text.length,
      text: cleanText(removeRepeatedLines(page.text, repeatedLines))
    }))
    .filter((page) => page.text.length > 0);
}

export function cleanText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function findRepeatedPageLines(texts: string[], minPages: number): Set<string> {
  if (minPages <= 1 || texts.length < minPages) {
    return new Set();
  }

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

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count >= minPages)
      .map(([line]) => line)
  );
}

function removeRepeatedLines(text: string, repeatedLines: Set<string>): string {
  if (repeatedLines.size === 0) {
    return text;
  }

  return text
    .split(/\r?\n/)
    .filter((line) => !repeatedLines.has(line.trim()))
    .join("\n");
}
