import { randomUUID } from "node:crypto";

export type IngestionJobStatus = "pending" | "running" | "indexed" | "skipped_duplicate" | "failed";

export interface IngestionJobRecord {
  id: string;
  status: IngestionJobStatus;
  title: string;
  documentId?: string;
  checksum?: string;
  version?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IngestionJobStore {
  create(input: { title: string }): Promise<IngestionJobRecord>;
  markRunning(id: string): Promise<IngestionJobRecord>;
  markSucceeded(
    id: string,
    input: {
      status: Extract<IngestionJobStatus, "indexed" | "skipped_duplicate">;
      documentId: string;
      checksum: string;
      version: number;
    }
  ): Promise<IngestionJobRecord>;
  markFailed(id: string, error: Error): Promise<IngestionJobRecord>;
  findById(id: string): Promise<IngestionJobRecord | null>;
}

export class InMemoryIngestionJobStore implements IngestionJobStore {
  private readonly jobs = new Map<string, IngestionJobRecord>();

  async create(input: { title: string }): Promise<IngestionJobRecord> {
    const now = new Date();
    const job: IngestionJobRecord = {
      id: randomUUID(),
      status: "pending",
      title: input.title,
      createdAt: now,
      updatedAt: now
    };
    this.jobs.set(job.id, job);
    return job;
  }

  async markRunning(id: string): Promise<IngestionJobRecord> {
    return this.update(id, { status: "running" });
  }

  async markSucceeded(
    id: string,
    input: {
      status: Extract<IngestionJobStatus, "indexed" | "skipped_duplicate">;
      documentId: string;
      checksum: string;
      version: number;
    }
  ): Promise<IngestionJobRecord> {
    return this.update(id, {
      status: input.status,
      documentId: input.documentId,
      checksum: input.checksum,
      version: input.version,
      errorMessage: undefined
    });
  }

  async markFailed(id: string, error: Error): Promise<IngestionJobRecord> {
    return this.update(id, {
      status: "failed",
      errorMessage: error.message
    });
  }

  async findById(id: string): Promise<IngestionJobRecord | null> {
    return this.jobs.get(id) ?? null;
  }

  list(): IngestionJobRecord[] {
    return [...this.jobs.values()];
  }

  private update(id: string, patch: Partial<IngestionJobRecord>): IngestionJobRecord {
    const existing = this.jobs.get(id);
    if (!existing) {
      throw new Error(`Ingestion job ${id} does not exist`);
    }

    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date()
    };
    this.jobs.set(id, updated);
    return updated;
  }
}
