export const conversationSchemaSql = `
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  title text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_updated_idx
  ON conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id uuid PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  provider text,
  model text,
  input_tokens integer,
  output_tokens integer,
  thinking_tokens integer,
  total_tokens integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_messages_conversation_created_idx
  ON conversation_messages (conversation_id, created_at ASC);
`;
