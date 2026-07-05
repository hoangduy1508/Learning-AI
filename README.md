# Learning AI

Hands-on projects for the [AI Integration Learning Plan](AI_LEARNING_PLAN.md).

## Project 1: Streaming AI Chat

The first portfolio project includes a [TypeScript AI backend](backend/README.md) and a
[React streaming frontend](frontend/README.md).

Implemented capabilities:

- Streaming chat UI with cancel support.
- Provider abstraction for fake, Gemini, and OpenAI.
- Conversation persistence with PostgreSQL.
- Sliding-window conversation context.
- Retry with exponential backoff and jitter.
- Per-user rate limiting.
- Provider fallback and in-memory response cache.
- Token, latency, and estimated cost tracking.
- Structured output and tool-calling labs.

## Week 5: pgvector Lab

The next lab starts the RAG storage layer with PostgreSQL + pgvector:

- Docker Compose uses `pgvector/pgvector:pg16`.
- `backend/src/vector/schema.ts` defines document and chunk tables.
- `npm run smoke:pgvector` creates the extension, inserts sample vectors, runs top-k cosine
  search, and checks vector dimension enforcement.

## Verify

Run backend checks:

```powershell
cd backend
npm run typecheck
npm test
npm run build
```

Run frontend checks:

```powershell
cd frontend
npm run typecheck
npm test
npm run build
```
