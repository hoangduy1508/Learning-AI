# AI Learning Backend

Backend Node.js + Fastify + TypeScript cho Project 1 và Project 2 trong kế hoạch học AI Integration.

## Yêu cầu

- Node.js 20 hoặc mới hơn

## Cài đặt

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

Mặc định `LLM_PROVIDER=fake` chạy được ngay, không cần credential.

## Chạy server

```powershell
npm run dev
```

Server mặc định chạy tại `http://127.0.0.1:8000`.

Kiểm tra health:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## Project 1: Streaming AI Chat

Backend cung cấp:

- `POST /api/chat` cho chat request thường.
- `POST /api/chat/stream` cho streaming chat qua Server-Sent Events.
- Provider abstraction cho `fake`, `openai`, `gemini`.
- Conversation persistence bằng PostgreSQL khi có `DATABASE_URL`.
- Sliding-window context, retry, rate limit, fallback provider và response cache.
- Token usage, latency, estimated cost và cache hit.
- `POST /api/structured/support-ticket` cho structured output bằng Zod.
- File agent API: `/api/agent/chat`, `/api/agent/pending`, `/api/agent/approve`, `/api/agent/audit`.

Ví dụ gọi chat:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/chat `
  -ContentType "application/json" `
  -Body '{"message":"Giải thích token của LLM là gì","userId":"demo-user"}'
```

## Project 2: Secure RAG PDF Assistant

Backend cung cấp:

- `POST /api/ingestion/upload` để upload tài liệu `text/plain` hoặc `application/pdf`.
- Parse, clean, chunk, embedding batch và index vào vector repository.
- Versioning bằng checksum, skip duplicate upload.
- Ingestion job status và error recovery.
- `POST /api/rag/query` để hỏi đáp RAG có citation.
- `POST /api/rag/evaluate` để đo retrieval recall, answer correctness và citation correctness.
- Retrieval strategy: `semantic`, `keyword`, `hybrid`.

Ví dụ upload tài liệu text:

```powershell
$body = @{
  tenantId = "demo"
  ownerUserId = "user-1"
  title = "Ghi chú RAG"
  sourceUri = "memory://rag-notes.txt"
  fileName = "rag-notes.txt"
  mimeType = "text/plain"
  contentEncoding = "utf8"
  content = "RAG gồm ingestion, retrieval, answer generation và citation."
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/ingestion/upload `
  -ContentType "application/json" `
  -Body $body
```

Ví dụ hỏi RAG:

```powershell
$body = @{
  tenantId = "demo"
  ownerUserId = "user-1"
  query = "RAG gồm những phần nào?"
  strategy = "hybrid"
  topK = 3
  similarityThreshold = 0.05
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/rag/query `
  -ContentType "application/json" `
  -Body $body
```

## Cấu hình provider

OpenAI:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
```

Gemini:

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Chỉ chọn một provider chính bằng `LLM_PROVIDER`. API key ở lại backend và không gửi xuống frontend.

## Production knobs

```dotenv
LLM_FALLBACK_PROVIDER=none
CHAT_CACHE_TTL_MS=0
CHAT_RATE_LIMIT_MAX_REQUESTS=20
CHAT_RATE_LIMIT_WINDOW_MS=60000
INGESTION_MAX_FILE_BYTES=1000000
OPENAI_INPUT_USD_PER_1M_TOKENS=0
OPENAI_OUTPUT_USD_PER_1M_TOKENS=0
OPENAI_THINKING_USD_PER_1M_TOKENS=0
GEMINI_INPUT_USD_PER_1M_TOKENS=0
GEMINI_OUTPUT_USD_PER_1M_TOKENS=0
GEMINI_THINKING_USD_PER_1M_TOKENS=0
```

Pricing mặc định bằng `0` để tránh hard-code giá đã cũ. Khi cần cost thật, cập nhật theo trang billing hiện tại của provider.

## PostgreSQL và pgvector

Chạy database từ root repo:

```powershell
docker compose up -d
```

Cấu hình `.env`:

```dotenv
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning
DATABASE_SSL=false
DATABASE_RUN_MIGRATIONS=true
```

Smoke test:

```powershell
npm run smoke:pgvector
```

## File agent

File agent chỉ thao tác trong thư mục allowlist:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\AI-learning
FILE_TOOL_ALLOW_WRITE=false
FILE_TOOL_ALLOW_DELETE=false
FILE_AGENT_AUTO_APPLY_WRITES=false
FILE_TOOL_MAX_FILE_BYTES=1000000
```

Giữ write/delete ở `false` nếu chỉ muốn đọc và tìm kiếm file.

## Lệnh kiểm tra

```powershell
npm run typecheck
npm test
npm run build
```

## Lab

```powershell
npm run learn:tokens
npm run learn:generation
npm run learn:ingestion
npm run learn:retrieval
npm run learn:rag-evaluation
npm run learn:agent-loop
```

Tài liệu chi tiết nằm trong thư mục `backend/docs/`.
