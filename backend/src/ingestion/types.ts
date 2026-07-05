export interface SourceDocument {
  tenantId: string;
  ownerUserId: string;
  title: string;
  sourceUri?: string;
  mimeType: "text/plain" | "application/pdf";
  contentEncoding?: "utf8" | "base64";
  content: string;
}

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  title: string;
  sourceUri?: string;
  pages: ParsedPage[];
  parser: "plain-text" | "pdf-text-pages" | "pdfjs";
}

export interface CleanedPage extends ParsedPage {
  originalLength: number;
}

export interface DocumentChunk {
  chunkIndex: number;
  content: string;
  pageNumber: number;
  metadata: {
    page: number;
    parser: ParsedDocument["parser"];
    chunking:
      | "fixed-size"
      | "recursive-text"
      | "structure-aware"
      | "parent-child-parent"
      | "parent-child-child";
    sectionTitle?: string;
    parentChunkIndex?: number;
    parentSectionTitle?: string;
    childOverlapCharacters?: number;
    tokenEstimate: number;
  };
}

export interface IngestionResult {
  documentId: string;
  chunkIds: string[];
  pageCount: number;
  chunkCount: number;
  checksum: string;
  version: number;
  status: "indexed" | "skipped_duplicate";
}
