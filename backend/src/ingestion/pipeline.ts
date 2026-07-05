import { createDeterministicEmbedding } from "../embeddings/deterministic.js";
import type { VectorRepository } from "../vector/repository.js";
import { chunkCleanedPages, type RecursiveChunkOptions } from "./chunking.js";
import { cleanParsedDocument } from "./clean.js";
import { parseSourceDocument } from "./parser.js";
import type { IngestionResult, SourceDocument } from "./types.js";
import {
  buildIngestionDocumentKey,
  createDocumentChecksum,
  type IngestionVersionStore
} from "./versioning.js";

export interface IngestionPipelineOptions {
  embeddingDimension: number;
  chunking: RecursiveChunkOptions;
  versionStore?: IngestionVersionStore;
}

export class IngestionPipeline {
  constructor(
    private readonly repository: VectorRepository,
    private readonly options: IngestionPipelineOptions
  ) {}

  async ingest(source: SourceDocument): Promise<IngestionResult> {
    const checksum = createDocumentChecksum(source);
    const versionKey = buildIngestionDocumentKey(source);
    const existingVersion = await this.options.versionStore?.findByChecksum(versionKey, checksum);
    if (existingVersion) {
      return {
        documentId: existingVersion.documentId,
        chunkIds: [],
        pageCount: 0,
        chunkCount: 0,
        checksum,
        version: existingVersion.version,
        status: "skipped_duplicate"
      };
    }

    const parsed = parseSourceDocument(source);
    const cleanedPages = cleanParsedDocument(parsed);
    const chunks = chunkCleanedPages(cleanedPages, parsed.parser, this.options.chunking);

    if (chunks.length === 0) {
      throw new Error("Document produced no chunks");
    }

    const version = (await this.options.versionStore?.nextVersion(versionKey)) ?? 1;
    const documentId = await this.repository.createDocument({
      tenantId: source.tenantId,
      ownerUserId: source.ownerUserId,
      title: source.title,
      sourceUri: source.sourceUri ? `${source.sourceUri}#v${version}` : undefined
    });

    const chunkIds: string[] = [];
    for (const chunk of chunks) {
      const chunkId = await this.repository.insertChunk({
        documentId,
        tenantId: source.tenantId,
        ownerUserId: source.ownerUserId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        metadata: {
          ...chunk.metadata,
          checksum,
          version,
          sourceUri: versionKey.sourceUri
        },
        embedding: createDeterministicEmbedding(chunk.content, this.options.embeddingDimension)
      });
      chunkIds.push(chunkId);
    }

    await this.options.versionStore?.save({
      key: versionKey,
      checksum,
      documentId,
      version
    });

    return {
      documentId,
      chunkIds,
      pageCount: cleanedPages.length,
      chunkCount: chunks.length,
      checksum,
      version,
      status: "indexed"
    };
  }
}
