import {
  DeterministicEmbeddingModel,
  embedTextsInBatches,
  type EmbeddingModel
} from "../embeddings/model.js";
import type { VectorRepository } from "../vector/repository.js";
import { chunkCleanedPages, type RecursiveChunkOptions } from "./chunking.js";
import { cleanParsedDocument } from "./clean.js";
import type { IngestionJobStore } from "./jobs.js";
import { parseSourceDocumentAsync } from "./parser.js";
import type { IngestionResult, SourceDocument } from "./types.js";
import {
  buildIngestionDocumentKey,
  createDocumentChecksum,
  type IngestionVersionStore
} from "./versioning.js";

export interface IngestionPipelineOptions {
  embeddingDimension: number;
  embeddingBatchSize?: number;
  embeddingModel?: EmbeddingModel;
  chunking: RecursiveChunkOptions;
  jobStore?: IngestionJobStore;
  versionStore?: IngestionVersionStore;
}

export class IngestionPipeline {
  constructor(
    private readonly repository: VectorRepository,
    private readonly options: IngestionPipelineOptions
  ) {}

  async ingest(source: SourceDocument): Promise<IngestionResult> {
    const job = await this.options.jobStore?.create({ title: source.title });
    const checksum = createDocumentChecksum(source);
    const versionKey = buildIngestionDocumentKey(source);
    try {
      if (job) {
        await this.options.jobStore?.markRunning(job.id);
      }

      const existingVersion = await this.options.versionStore?.findByChecksum(versionKey, checksum);
      if (existingVersion) {
        await this.options.jobStore?.markSucceeded(job?.id ?? "", {
          status: "skipped_duplicate",
          documentId: existingVersion.documentId,
          checksum,
          version: existingVersion.version
        });
        return {
          jobId: job?.id,
          documentId: existingVersion.documentId,
          chunkIds: [],
          pageCount: 0,
          chunkCount: 0,
          checksum,
          version: existingVersion.version,
          status: "skipped_duplicate",
          embeddingBatchCount: 0
        };
      }

      const parsed = await parseSourceDocumentAsync(source);
      const cleanedPages = cleanParsedDocument(parsed);
      const chunks = chunkCleanedPages(cleanedPages, parsed.parser, this.options.chunking);

      if (chunks.length === 0) {
        throw new Error("Document produced no chunks");
      }

      const embeddingModel =
        this.options.embeddingModel ?? new DeterministicEmbeddingModel(this.options.embeddingDimension);
      const embeddingBatchSize = this.options.embeddingBatchSize ?? 16;
      const embeddings = await embedTextsInBatches(
        embeddingModel,
        chunks.map((chunk) => chunk.content),
        embeddingBatchSize
      );
      const embeddingBatchCount = Math.ceil(chunks.length / embeddingBatchSize);

      const version = (await this.options.versionStore?.nextVersion(versionKey)) ?? 1;
      const documentId = await this.repository.createDocument({
        tenantId: source.tenantId,
        ownerUserId: source.ownerUserId,
        title: source.title,
        sourceUri: source.sourceUri ? `${source.sourceUri}#v${version}` : undefined
      });

      const chunkIds: string[] = [];
      for (const [index, chunk] of chunks.entries()) {
        const embedding = embeddings[index];
        if (!embedding) {
          throw new Error(`Missing embedding for chunk ${index}`);
        }

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
          embedding
        });
        chunkIds.push(chunkId);
      }

      await this.options.versionStore?.save({
        key: versionKey,
        checksum,
        documentId,
        version
      });
      await this.options.jobStore?.markSucceeded(job?.id ?? "", {
        status: "indexed",
        documentId,
        checksum,
        version
      });

      return {
        jobId: job?.id,
        documentId,
        chunkIds,
        pageCount: cleanedPages.length,
        chunkCount: chunks.length,
        checksum,
        version,
        status: "indexed",
        embeddingBatchCount
      };
    } catch (error) {
      if (job) {
        await this.options.jobStore?.markFailed(
          job.id,
          error instanceof Error ? error : new Error("Unknown ingestion failure")
        );
      }
      throw error;
    }
  }
}
