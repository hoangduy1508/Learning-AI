import type { CleanedPage, ParsedDocument } from "./types.js";

export function cleanParsedDocument(document: ParsedDocument): CleanedPage[] {
  return document.pages
    .map((page) => ({
      pageNumber: page.pageNumber,
      originalLength: page.text.length,
      text: cleanText(page.text)
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
