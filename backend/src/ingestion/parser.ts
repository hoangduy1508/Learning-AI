import type { ParsedDocument, SourceDocument } from "./types.js";

const pdfPageBreakPattern = /\n\s*---page---\s*\n/iu;
const pdfMagicHeader = "%PDF-";

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
    if (source.contentEncoding === "base64" || looksLikePdfBytes(source.content)) {
      throw new Error("Binary PDF parsing requires parseSourceDocumentAsync()");
    }
    return parsePdfTextPages(source);
  }

  const unreachable: never = source.mimeType;
  throw new Error(`Unsupported document type: ${unreachable}`);
}

export async function parseSourceDocumentAsync(source: SourceDocument): Promise<ParsedDocument> {
  if (source.mimeType === "application/pdf" && source.contentEncoding === "base64") {
    return parsePdfBase64(source);
  }

  return parseSourceDocument(source);
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

async function parsePdfBase64(source: SourceDocument): Promise<ParsedDocument> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdfBytes = Buffer.from(source.content, "base64");
  if (!pdfBytes.subarray(0, 5).toString("utf8").startsWith(pdfMagicHeader)) {
    throw new Error("PDF content does not start with a %PDF header");
  }

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(pdfBytes),
    useSystemFonts: true
  }).promise;

  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();
    pages.push({ pageNumber, text });
  }

  const extractablePages = pages.filter((page) => page.text.length > 0);
  if (extractablePages.length === 0) {
    throw new Error("Parsed PDF has no extractable text pages");
  }

  return {
    title: source.title,
    sourceUri: source.sourceUri,
    parser: "pdfjs",
    pages: extractablePages
  };
}

function looksLikePdfBytes(content: string): boolean {
  return content.startsWith(pdfMagicHeader);
}
