# AI Learning Backend

Node.js + TypeScript service for Project 1 of the AI Integration learning plan.

## Requirements

- Node.js 20 or newer

## Setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

The default `LLM_PROVIDER=fake` works without credentials. The route contract is independent
of the selected provider.

## Run

```powershell
npm run dev
```

Call the API with:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/chat `
  -ContentType "application/json" `
  -Body '{"message":"Explain what an LLM token is"}'
```

## Use OpenAI

Edit `.env` without committing it:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
```

The API key stays in the Node.js backend and is never sent to the React application.

## Use Gemini

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Select exactly one provider with `LLM_PROVIDER`. Provider credentials remain on the backend.
To add another provider later, implement `LlmProvider` and register it in
`src/providers/index.ts`; routes and frontend code do not need to change.

## Production basics

Useful environment knobs for the Project 1 demo:

```dotenv
LLM_FALLBACK_PROVIDER=none
CHAT_CACHE_TTL_MS=0
CHAT_RATE_LIMIT_MAX_REQUESTS=20
CHAT_RATE_LIMIT_WINDOW_MS=60000
OPENAI_INPUT_USD_PER_1M_TOKENS=0
OPENAI_OUTPUT_USD_PER_1M_TOKENS=0
GEMINI_INPUT_USD_PER_1M_TOKENS=0
GEMINI_OUTPUT_USD_PER_1M_TOKENS=0
```

Cost pricing defaults to zero so the code does not bake in stale provider pricing. Fill these
values from the active provider billing page when you want real estimates.

## Verify

```powershell
npm run typecheck
npm test
npm run build
```

## Token lab

```powershell
npm run learn:tokens
```

See [Tokens and Context](docs/01_TOKENS_AND_CONTEXT.md) for the concepts and interpretation.

## Generation controls lab

```powershell
npm run learn:generation
```

See [Generation Controls](docs/02_GENERATION_CONTROLS.md) for system instructions, temperature,
output limits, and stop conditions.

## Streaming chat

`POST /api/chat/stream` returns `text/event-stream` events with the contract documented in
[Streaming Chat](docs/03_STREAMING_CHAT.md).

## Conversation and telemetry

When `DATABASE_URL` is configured, chat messages are persisted and the UI can show project
telemetry for `demo-user`.

```powershell
Invoke-RestMethod `
  -Method Get `
  -Uri http://127.0.0.1:8000/api/users/demo-user/cost-summary
```

See [Conversation Persistence](docs/08_CONVERSATION_PERSISTENCE.md) for schema, context window,
retry, rate limiting, provider routing, cache, and cost tracking notes.

## pgvector lab

`docker-compose.yml` uses `pgvector/pgvector:pg16` for Week 5. After PostgreSQL is running:

```powershell
$env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/ai_learning"
npm run smoke:pgvector
```

See [Embeddings and pgvector](docs/09_EMBEDDINGS_AND_PGVECTOR.md).

## RAG ingestion lab

```powershell
npm run learn:ingestion
```

See [RAG Ingestion Pipeline](docs/10_RAG_INGESTION_PIPELINE.md) for parse, clean, chunk,
embed, and index notes.

## Filesystem tools

The backend can list, read, search, write, and delete files inside configured allowlisted roots.
See [Filesystem Tools](docs/06_FILESYSTEM_TOOLS.md).
