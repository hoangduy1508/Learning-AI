import { createHash } from "node:crypto";

import type { SourceDocument } from "./types.js";

export interface IngestionDocumentKey {
  tenantId: string;
  ownerUserId: string;
  sourceUri: string;
}

export interface IngestionVersionRecord {
  key: IngestionDocumentKey;
  checksum: string;
  documentId: string;
  version: number;
}

export interface IngestionVersionStore {
  findByChecksum(
    key: IngestionDocumentKey,
    checksum: string
  ): Promise<IngestionVersionRecord | undefined>;
  nextVersion(key: IngestionDocumentKey): Promise<number>;
  save(record: IngestionVersionRecord): Promise<void>;
}

export class InMemoryIngestionVersionStore implements IngestionVersionStore {
  private readonly records: IngestionVersionRecord[] = [];

  async findByChecksum(
    key: IngestionDocumentKey,
    checksum: string
  ): Promise<IngestionVersionRecord | undefined> {
    return this.records.find(
      (record) =>
        record.key.tenantId === key.tenantId &&
        record.key.ownerUserId === key.ownerUserId &&
        record.key.sourceUri === key.sourceUri &&
        record.checksum === checksum
    );
  }

  async nextVersion(key: IngestionDocumentKey): Promise<number> {
    const versions = this.records
      .filter(
        (record) =>
          record.key.tenantId === key.tenantId &&
          record.key.ownerUserId === key.ownerUserId &&
          record.key.sourceUri === key.sourceUri
      )
      .map((record) => record.version);

    return versions.length === 0 ? 1 : Math.max(...versions) + 1;
  }

  async save(record: IngestionVersionRecord): Promise<void> {
    this.records.push(record);
  }
}

export function buildIngestionDocumentKey(source: SourceDocument): IngestionDocumentKey {
  return {
    tenantId: source.tenantId,
    ownerUserId: source.ownerUserId,
    sourceUri: source.sourceUri ?? `title:${source.title}`
  };
}

export function createDocumentChecksum(source: SourceDocument): string {
  const hash = createHash("sha256").update(source.mimeType).update("\n");
  if (source.contentEncoding === "base64") {
    hash.update(Buffer.from(source.content, "base64"));
  } else {
    hash.update(source.content, "utf8");
  }
  return hash.digest("hex");
}
