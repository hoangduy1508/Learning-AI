import type { ParsedDocument, SourceDocument } from "./types.js";

const pdfPageBreakPattern = /\n\s*---page---\s*\n/iu;

export function parseSourceDocument(source: SourceDocument): ParsedDocument {
  if (source.mimeType === "text/plain") {
    return {
      title: source.title,
      sourceUri: source.sourceUri,
      parser: "plain-text",
      pages: [{ pageNumber: 1, text: source.content }]
    };
  }

  if (source.mimeType === "application/pdf") {
    return parsePdfTextPages(source);
  }

  const unreachable: never = source.mimeType;
  throw new Error(`Unsupported document type: ${unreachable}`);
}

function parsePdfTextPages(source: SourceDocument): ParsedDocument {
  const pages = source.content
    .split(pdfPageBreakPattern)
    .map((text, index) => ({ pageNumber: index + 1, text }))
    .filter((page) => page.text.trim().length > 0);

  if (pages.length === 0) {
    throw new Error("Parsed PDF has no extractable text pages");
  }

  return {
    title: source.title,
    sourceUri: source.sourceUri,
    parser: "pdf-text-pages",
    pages
  };
}
