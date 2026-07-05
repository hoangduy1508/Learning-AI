export const pgvectorDimension = 4;

export const pgvectorSchemaSql = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
  id uuid PRIMARY KEY,
  tenant_id text NOT NULL,
  owner_user_id text NOT NULL,
  title text NOT NULL,
  source_uri text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rag_document_chunks (
  id uuid PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  owner_user_id text NOT NULL,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding vector(${pgvectorDimension}) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS rag_document_chunks_tenant_owner_idx
  ON rag_document_chunks (tenant_id, owner_user_id);

CREATE INDEX IF NOT EXISTS rag_document_chunks_embedding_hnsw_idx
  ON rag_document_chunks
  USING hnsw (embedding vector_cosine_ops);
`;
