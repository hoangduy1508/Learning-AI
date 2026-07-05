import { formatVectorLiteral } from "../embeddings/deterministic.js";
import type { VectorSearchQuery } from "./repository.js";

export interface QueryPlanSql {
  sql: string;
  values: unknown[];
}

export function buildHnswExplainSql(query: VectorSearchQuery): QueryPlanSql {
  const values: unknown[] = [
    formatVectorLiteral(query.embedding),
    query.tenantId,
    query.ownerUserId,
    query.topK
  ];
  const metadataSql = buildMetadataFilterSql(query.metadata, values);

  return {
    sql: `
      EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE)
      SELECT id, document_id, content, metadata, embedding <=> $1::vector AS distance
      FROM rag_document_chunks
      WHERE tenant_id = $2
        AND owner_user_id = $3
        ${metadataSql}
      ORDER BY embedding <=> $1::vector
      LIMIT $4
    `,
    values
  };
}

function buildMetadataFilterSql(
  metadata: VectorSearchQuery["metadata"],
  values: unknown[]
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  return Object.entries(metadata)
    .map(([key, value]) => {
      values.push(key, String(value));
      const keyIndex = values.length - 1;
      const valueIndex = values.length;
      return `AND metadata ->> $${keyIndex} = $${valueIndex}`;
    })
    .join("\n        ");
}
