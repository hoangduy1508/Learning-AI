import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import type { VectorRepository } from "../vector/repository.js";
import { chunkCleanedPages, type RecursiveChunkOptions } from "./chunking.js";
import { cleanParsedDocument } from "./clean.js";
import { parseSourceDocument } from "./parser.js";
import type { IngestionResult, SourceDocument } from "./types.js";

export interface IngestionPipelineOptions {
  embeddingDimension: number;
  chunking: RecursiveChunkOptions;
}

export class IngestionPipeline {
  constructor(
    private readonly repository: VectorRepository,
    private readonly options: IngestionPipelineOptions
  ) {}

  async ingest(source: SourceDocument): Promise<IngestionResult> {
    const parsed = parseSourceDocument(source);
    const cleanedPages = cleanParsedDocument(parsed);
    const chunks = chunkCleanedPages(cleanedPages, parsed.parser, this.options.chunking);

    if (chunks.length === 0) {
      throw new Error("Document produced no chunks");
    }

    const documentId = await this.repository.createDocument({
      tenantId: source.tenantId,
      ownerUserId: source.ownerUserId,
      title: source.title,
      sourceUri: source.sourceUri
    });

    const chunkIds: string[] = [];
    for (const chunk of chunks) {
      const chunkId = await this.repository.insertChunk({
        documentId,
        tenantId: source.tenantId,
        ownerUserId: source.ownerUserId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: chunk.metadata,
        embedding: createDeterministicEmbedding(chunk.content, this.options.embeddingDimension)
      });
      chunkIds.push(chunkId);
    }

    return {
      documentId,
      chunkIds,
      pageCount: cleanedPages.length,
      chunkCount: chunks.length
    };
  }
}
