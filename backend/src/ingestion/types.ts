export interface SourceDocument {
  tenantId: string;
  ownerUserId: string;
  title: string;
  sourceUri?: string;
  mimeType: "text/plain" | "application/pdf";
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
  parser: "plain-text" | "pdf-text-pages";
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
    chunking: "recursive-text";
    tokenEstimate: number;
  };
}

export interface IngestionResult {
  documentId: string;
  chunkIds: string[];
  pageCount: number;
  chunkCount: number;
}
