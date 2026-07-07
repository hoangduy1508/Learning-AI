# AI Learning

Repo thực hành theo [AI Integration Learning Plan](AI_LEARNING_PLAN.md). Hiện repo có hai project chính:

- **Project 1: Streaming AI Chat** - chat AI có streaming, conversation, telemetry, structured output, tool calling và file agent.
- **Project 2: Secure RAG PDF Assistant** - ingestion tài liệu, vector search, hỏi đáp RAG có citation và evaluation.

Frontend hiện gom cả hai project vào cùng một UI tại `http://127.0.0.1:5173`.

## Kiến trúc nhanh

```text
frontend/ React + TypeScript + Vite
  |-- Chat streaming
  |-- Structured output
  |-- File agent/tools
  |-- RAG upload/query/evaluation

backend/ Node.js + Fastify + TypeScript
  |-- LLM provider abstraction: fake, OpenAI, Gemini
  |-- Chat, SSE streaming, retry, rate limit, cache, cost tracking
  |-- PostgreSQL conversation persistence
  |-- Ingestion pipeline: parse, clean, chunk, embed, index
  |-- Retrieval pipeline: semantic, keyword, hybrid, citation, evaluation
  |-- File tools và agent loop có guardrail

docker-compose.yml
  |-- PostgreSQL + pgvector cho lab vector/RAG
```

## Project 1: Streaming AI Chat

Tính năng chính:

- Chat UI có streaming token qua `text/event-stream`.
- Nút dừng generation khi model đang trả lời.
- Provider abstraction cho `fake`, `openai`, `gemini`.
- Conversation persistence bằng PostgreSQL khi cấu hình `DATABASE_URL`.
- Sliding-window conversation context để đưa lịch sử chat vào prompt.
- Retry với exponential backoff và jitter.
- Rate limit theo user cho cả chat thường và chat streaming.
- Provider fallback và in-memory response cache.
- Theo dõi token usage, latency, estimated cost và cache hit.
- Structured output lab cho support ticket bằng Zod.
- Tool calling lab cho weather, order lookup và support ticket approval.
- File agent UI để list/read/search/write/delete file trong thư mục allowlist, có pending approval và audit log.

Tab UI liên quan:

- `Chat`: demo chat streaming của Project 1.
- `Structured`: trích xuất support ticket theo schema.
- `Tools`: file agent, tool calls, pending actions và audit log.

API quan trọng:

- `GET /health`
- `POST /api/chat`
- `POST /api/chat/stream`
- `GET /api/users/:userId/cost-summary`
- `POST /api/structured/support-ticket`
- `POST /api/agent/chat`
- `GET /api/agent/pending`
- `POST /api/agent/approve`
- `GET /api/agent/audit`

## Project 2: Secure RAG PDF Assistant

Tính năng chính:

- Upload tài liệu dạng JSON lab, hỗ trợ `text/plain` và `application/pdf`.
- PDF được gửi bằng `base64`; text được gửi bằng `utf8`.
- Parse tài liệu và giữ page number để phục vụ citation.
- Clean text, phân tích artifact, loại vấn đề thường gặp như header/footer lặp.
- Chunking nhiều chiến lược: fixed-size, recursive, structure-aware và parent-child.
- Versioning bằng checksum: upload trùng nội dung sẽ `skipped_duplicate`.
- Ingestion job status: `pending`, `running`, `indexed`, `skipped_duplicate`, `failed`.
- Batch embedding để mô phỏng workload ingestion thật.
- Vector repository in-memory cho demo/test; có lab PostgreSQL + pgvector.
- Retrieval theo `semantic`, `keyword`, hoặc `hybrid`.
- Refusal khi context truy xuất yếu hơn threshold.
- Answer có citation gồm `documentId`, `chunkId`, `pageNumber`, `sourceUri`.
- RAG evaluation đo retrieval recall, answer correctness và citation correctness.

Tab UI liên quan:

- `RAG`: upload tài liệu, hỏi đáp trên tài liệu, xem context/citation và chạy evaluation nhanh.

API quan trọng:

- `POST /api/ingestion/upload`
- `POST /api/rag/query`
- `POST /api/rag/evaluate`

## Cách chạy local

### 1. Cài dependencies

```powershell
cd backend
npm install
Copy-Item .env.example .env

cd ..\frontend
npm install
```

Mặc định `LLM_PROVIDER=fake` chạy được ngay, không cần API key.

### 2. Chạy backend

```powershell
cd backend
npm run dev
```

Backend mặc định chạy tại:

```text
http://127.0.0.1:8000
```

### 3. Chạy frontend

Mở terminal khác:

```powershell
cd frontend
npm run dev
```

Frontend mặc định chạy tại:

```text
http://127.0.0.1:5173
```

## Cách dùng UI

### Chat

1. Mở tab `Chat`.
2. Nhập câu hỏi.
3. Bấm gửi để nhận streaming answer.
4. Quan sát provider, model, token usage, latency, estimated cost và conversation id.

### Structured

1. Mở tab `Structured`.
2. Dán nội dung yêu cầu hỗ trợ.
3. UI gọi backend để model trả JSON.
4. Backend validate bằng Zod trước khi trả kết quả typed.

### Tools

1. Mở tab `Tools`.
2. Nhập prompt cho file agent.
3. Xem tool calls, tool results, pending actions và audit log.
4. Muốn write/delete thật cần cấu hình allowlist trong `.env`.

### RAG

1. Mở tab `RAG`.
2. Nhập `tenantId`, `ownerUserId`, title và source URI.
3. Chọn file `.txt` hoặc `.pdf`.
4. Bấm upload để chạy ingestion.
5. Nhập câu hỏi về tài liệu.
6. Chọn strategy, `topK`, threshold rồi hỏi.
7. Xem answer, retrieved contexts và citations.
8. Dùng khung evaluation để kiểm tra expected text/page.

## Cấu hình LLM provider

Fake provider:

```dotenv
LLM_PROVIDER=fake
```

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

API key chỉ nằm ở backend, không gửi xuống frontend.

## Cấu hình PostgreSQL và pgvector

Chạy database:

```powershell
docker compose up -d
```

Cấu hình backend `.env`:

```dotenv
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning
DATABASE_SSL=false
DATABASE_RUN_MIGRATIONS=true
```

Chạy smoke test pgvector:

```powershell
cd backend
npm run smoke:pgvector
```

Lưu ý: UI RAG hiện dùng repository in-memory trong process backend để demo nhanh. Khi restart backend, tài liệu đã upload trong UI sẽ mất và cần upload lại.

## Cấu hình file agent

File agent chỉ được thao tác trong thư mục allowlist:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\AI-learning
FILE_TOOL_ALLOW_WRITE=false
FILE_TOOL_ALLOW_DELETE=false
FILE_AGENT_AUTO_APPLY_WRITES=false
FILE_TOOL_MAX_FILE_BYTES=1000000
```

Khuyến nghị giữ `FILE_TOOL_ALLOW_WRITE=false` và `FILE_TOOL_ALLOW_DELETE=false` khi học hoặc demo với dữ liệu thật.

## Lệnh kiểm tra

Backend:

```powershell
cd backend
npm run typecheck
npm test
npm run build
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm test
npm run build
```

## Lab và tài liệu học

- `backend/docs/01_TOKENS_AND_CONTEXT.md`
- `backend/docs/02_GENERATION_CONTROLS.md`
- `backend/docs/03_STREAMING_CHAT.md`
- `backend/docs/04_STRUCTURED_OUTPUT.md`
- `backend/docs/05_TOOL_CALLING.md`
- `backend/docs/06_FILESYSTEM_TOOLS.md`
- `backend/docs/08_CONVERSATION_PERSISTENCE.md`
- `backend/docs/09_EMBEDDINGS_AND_PGVECTOR.md`
- `backend/docs/10_RAG_INGESTION_PIPELINE.md`
- `backend/docs/11_RAG_RETRIEVAL_EVALUATION.md`
- `backend/docs/12_AGENT_LOOP_FROM_FIRST_PRINCIPLES.md`

Chạy các lab:

```powershell
cd backend
npm run learn:tokens
npm run learn:generation
npm run learn:ingestion
npm run learn:retrieval
npm run learn:rag-evaluation
npm run learn:agent-loop
```

## Ghi chú vận hành

- `.env` không được commit.
- Pricing mặc định bằng `0`, cần tự cập nhật theo billing page hiện tại nếu muốn ước tính cost thật.
- RAG demo hiện dùng deterministic embedding để test ổn định; có thể thay bằng embedding provider thật sau.
- Khi build backend trong môi trường sandbox có thể gặp lỗi `EPERM` với `backend/dist`; chạy lại build ngoài sandbox hoặc xóa output cũ bằng quyền phù hợp.
