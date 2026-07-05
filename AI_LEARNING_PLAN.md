# AI Integration Learning Plan

> File context dài hạn cho lộ trình học AI Integration dành cho Senior Fullstack Developer sử dụng TypeScript end-to-end với ReactJS + Node.js.

## Cách sử dụng file này

Khi bắt đầu một phiên làm việc mới, dùng yêu cầu:

```text
Hãy đọc AI_LEARNING_PLAN.md, kiểm tra mục Current Progress và tiếp tục hướng dẫn tôi hoàn thành task tiếp theo. Khi hoàn thành, cập nhật lại checklist và nhật ký trong file.
```

Quy ước tiến độ:

- `[ ]`: Chưa làm
- `[~]`: Đang làm
- `[x]`: Đã hoàn thành và kiểm chứng
- Chỉ đánh dấu hoàn thành khi đã có code, test hoặc ghi chú chứng minh kiến thức.

## Learner Profile

- Vai trò mục tiêu: Senior Fullstack Developer có khả năng xây dựng sản phẩm AI production-ready
- Nền tảng chính: ReactJS, Node.js và TypeScript
- Thời gian dự kiến: 12 tuần
- Cường độ: 12-15 giờ mỗi tuần
- Trọng tâm: AI Integration, RAG, Agent, MCP, System Design, Security
- Không ưu tiên: Huấn luyện LLM từ đầu hoặc nghiên cứu thuật toán ML chuyên sâu

## Mục tiêu đầu ra

Sau lộ trình này, cần có khả năng:

1. Tích hợp nhiều LLM provider qua backend an toàn.
2. Xây dựng chat streaming và quản lý conversation history.
3. Sử dụng structured output và tool calling có validation.
4. Xây dựng RAG với PostgreSQL + pgvector và citation.
5. Đánh giá chất lượng retrieval và câu trả lời bằng test set.
6. Thiết kế agent có state, giới hạn quyền và human approval.
7. Xây dựng, kết nối và bảo vệ MCP server.
8. Thiết kế hệ thống AI có authentication, monitoring, caching và cost control.
9. Nhận diện và giảm prompt injection, data leakage và excessive agency.
10. Trình bày rõ các quyết định kiến trúc trong phỏng vấn Senior.

## Thứ tự ưu tiên

1. AI Integration
2. RAG và PostgreSQL/pgvector
3. AI System Design và Security
4. Agent và Tool Calling
5. MCP
6. Framework như LangGraph.js và LangChain.js

Nguyên tắc: học API và kiến trúc nguyên bản trước, framework sau.

## Technology Stack

### Frontend

- ReactJS
- TypeScript
- Vite
- React Router
- TanStack Query cho server state khi phù hợp
- Streaming qua `fetch`, SSE hoặc `ReadableStream`
- Markdown rendering và syntax highlighting

### Backend

- Node.js
- TypeScript
- Fastify
- Zod
- Drizzle ORM
- PostgreSQL migration bằng Drizzle Kit

### AI

- OpenAI Responses API làm provider đầu tiên
- Google Gemini API, OpenAI API và sau đó Anthropic API để học provider abstraction
- LangGraph.js cho workflow/agent có state
- MCP TypeScript SDK

### Data và Infrastructure

- PostgreSQL
- pgvector
- Redis khi cần caching/rate limiting
- Docker Compose
- Node.js test runner (`node:test`)

## Kế hoạch 12 tuần

### Tuần 1: Nền tảng LLM API

Kiến thức:

- [x] Hiểu token, tokenizer và context window
- [x] Hiểu system instruction, user input và model output
- [x] Hiểu temperature, output limit và stop condition
- [x] Quản lý API key bằng environment variable
- [x] Đọc token usage, latency và ước tính cost
- [x] Phân biệt model, API và provider

Thực hành:

- [x] Tạo Node.js + TypeScript project có cấu trúc rõ ràng
- [x] Tạo endpoint `POST /api/chat`
- [x] Gọi LLM provider thật từ backend (Gemini Free Tier)
- [x] Không để API key hoặc provider credential trong ReactJS
- [x] Ghi log model, latency, input token và output token
- [x] Viết unit test cho service gọi LLM bằng mock

Definition of Done:

- API trả lời được câu hỏi.
- Secret không xuất hiện trong source code hoặc frontend bundle.
- Có xử lý timeout và lỗi provider cơ bản.

### Tuần 2: Streaming Chat

Kiến thức:

- [x] Hiểu HTTP streaming
- [x] So sánh SSE, WebSocket và streaming `fetch`
- [x] Hiểu event/chunk/delta
- [x] Hiểu perceived latency và total latency
- [x] Hiểu cancel, timeout, retry và mất kết nối

Thực hành:

- [x] Stream output từ provider qua Fastify
- [x] ReactJS hiển thị từng phần của câu trả lời
- [x] Thêm nút Stop generating
- [x] Abort request trong cleanup của `useEffect` hoặc khi người dùng bấm Stop
- [x] Xử lý loading, partial output và error state
- [x] Test parser với chunk bị chia ở vị trí bất kỳ

Definition of Done:

- Người dùng thấy token/chunk xuất hiện dần.
- Hủy request giải phóng tài nguyên backend.
- Lỗi giữa stream được hiển thị đúng trên UI.

### Tuần 3: Structured Output và Tool Calling

Kiến thức:

- [x] Hiểu JSON Schema
- [x] Phân biệt JSON mode và schema-constrained output
- [x] Phân biệt structured output và tool calling
- [x] Hiểu tool choice, tool arguments và tool result
- [x] Không tin tưởng dữ liệu do model tạo ra

Thực hành:

- [x] Parse structured output bằng Zod
- [x] Tạo tool thời tiết giả lập
- [x] Tạo tool đọc trạng thái đơn hàng
- [x] Tạo tool tạo support ticket
- [x] Validate authorization trước khi gọi tool
- [x] Yêu cầu confirmation trước write action
- [x] Test malformed arguments và unauthorized call

Definition of Done:

- Model không trực tiếp chạy SQL.
- Mọi tool input đều được validate.
- Write action có idempotency hoặc confirmation.

### Tuần 4: Conversation và Production Basics

Kiến thức:

- [x] Thiết kế bảng conversation và message
- [x] Hiểu sliding window, truncation, summarization và compaction
- [x] Hiểu retry với exponential backoff và jitter
- [x] Hiểu rate limiting
- [x] Hiểu model routing, fallback và caching

Thực hành:

- [x] Lưu conversation trong PostgreSQL
- [x] Chỉ gửi history cần thiết cho model
- [x] Thêm giới hạn message/context
- [x] Thêm rate limit theo user
- [x] Theo dõi cost theo request và user
- [x] Hoàn thiện Project 1

Definition of Done:

- Conversation tiếp tục được sau khi reload trang.
- History dài không làm request vượt context window.
- Có test cho retry, rate limit và conversation ownership.

### Tuần 5: Embedding và Vector Search

Kiến thức:

- [x] Hiểu embedding và vector dimension
- [x] Hiểu cosine similarity, cosine distance, dot product và L2
- [x] Hiểu exact và approximate nearest-neighbor search
- [x] Hiểu HNSW và IVFFlat ở mức sử dụng
- [x] Hiểu metadata filtering

Thực hành:

- [x] Chạy PostgreSQL + pgvector bằng Docker
- [x] Tạo bảng document và document chunk
- [x] Lưu embedding kèm metadata
- [x] Truy vấn top-k bằng cosine distance
- [x] So sánh kết quả với các query khác nhau
- [x] Thử HNSW index và xem query plan

Definition of Done:

- Giải thích được vì sao kết quả gần nhất không nhất thiết đúng nhất.
- Query luôn lọc theo tenant/user trước khi trả context.

### Tuần 6: RAG Ingestion Pipeline

Kiến thức:

- [x] Hiểu parse, OCR, clean, chunk, embed và index
- [ ] So sánh fixed-size, recursive và structure-aware chunking
- [ ] Hiểu chunk overlap và parent-child chunking
- [ ] Hiểu tác động của bảng, header, footer và scanned PDF
- [ ] Hiểu document versioning và re-indexing

Thực hành:

- [ ] Upload và kiểm tra loại/kích thước file
- [ ] Parse PDF và giữ page number
- [ ] Chunk theo cấu trúc tài liệu khi có thể
- [ ] Batch embedding
- [ ] Lưu checksum để tránh xử lý trùng
- [ ] Thêm trạng thái ingestion và error recovery

Definition of Done:

- Có thể trace mỗi chunk về đúng document và page.
- Re-upload cùng file không tạo dữ liệu trùng.
- File lỗi không làm hỏng toàn bộ ingestion job.

### Tuần 7: Retrieval và RAG Evaluation

Kiến thức:

- [ ] Hiểu top-k và similarity threshold
- [ ] Hiểu keyword/BM25 và semantic search
- [ ] Hiểu hybrid search
- [ ] Hiểu query rewriting và multi-query retrieval
- [ ] Hiểu reranking
- [ ] Phân biệt retrieval quality và generation quality

Thực hành:

- [ ] Xây retrieval pipeline có metadata filter
- [ ] Trả lời kèm citation và page number
- [ ] Từ chối khi không đủ bằng chứng
- [ ] Tạo 30-50 câu hỏi có đáp án chuẩn
- [ ] Đo retrieval recall, answer correctness và citation correctness
- [ ] So sánh ít nhất hai chunking/retrieval strategy
- [ ] Hoàn thiện Project 2

Definition of Done:

- Có evaluation report thay vì chỉ demo thủ công.
- Không cho model trích nguồn không nằm trong retrieved context.

### Tuần 8: Agent từ nguyên lý

Kiến thức:

- [ ] Hiểu agent loop: decide, act, observe, answer
- [ ] Phân biệt agent và deterministic workflow
- [ ] Hiểu state, memory, planning và tool selection
- [ ] Hiểu maximum iteration, timeout và budget
- [ ] Hiểu human-in-the-loop và excessive agency

Thực hành:

- [ ] Tự viết agent loop nhỏ không dùng framework
- [ ] Cho agent lựa chọn giữa 2-3 read-only tools
- [ ] Thêm giới hạn số vòng lặp
- [ ] Thêm timeout và token/cost budget
- [ ] Thêm audit log cho tool call
- [ ] Ngăn tool result độc hại trở thành instruction

Definition of Done:

- Agent luôn kết thúc trong giới hạn cấu hình.
- Tool call thất bại có trạng thái và thông báo rõ ràng.
- Có thể giải thích khi nào không nên dùng agent.

### Tuần 9: LangGraph.js

Kiến thức:

- [ ] Hiểu state graph, node, edge và conditional edge
- [ ] Hiểu checkpoint và persistence
- [ ] Hiểu interrupt/human approval
- [ ] Hiểu retry và error recovery theo node
- [ ] Hiểu observability cho workflow nhiều bước

Thực hành:

- [ ] Chuyển agent loop sang LangGraph.js
- [ ] Tạo bước classify, retrieve, choose tool và answer
- [ ] Thêm approval trước write action
- [ ] Persist state để resume workflow
- [ ] Test từng node độc lập
- [ ] Test đường đi thành công và thất bại

Definition of Done:

- Workflow có sơ đồ và state schema rõ ràng.
- Có thể resume sau khi chờ approval hoặc gặp lỗi tạm thời.

### Tuần 10: MCP

Kiến thức:

- [ ] Hiểu MCP host, client và server
- [ ] Hiểu tools, resources và prompts
- [ ] Hiểu capability discovery
- [ ] Hiểu local và remote transport
- [ ] Hiểu authentication, authorization và trust boundary
- [ ] Phân biệt MCP, REST API và LLM tool calling

Thực hành:

- [ ] Viết MCP server bằng TypeScript
- [ ] Expose một read-only database tool
- [ ] Expose tài liệu nội bộ dưới dạng resource
- [ ] Validate mọi tool input
- [ ] Thêm access control và audit log
- [ ] Kết nối MCP server với một MCP client

Definition of Done:

- MCP server không expose credential hoặc dữ liệu ngoài quyền user.
- Tool description và schema đủ rõ để client sử dụng đúng.

### Tuần 11: Security và Observability

Kiến thức:

- [ ] Hiểu direct và indirect prompt injection
- [ ] Hiểu data leakage và sensitive data exposure
- [ ] Hiểu jailbreak, insecure output handling và excessive agency
- [ ] Hiểu tenant isolation và least privilege
- [ ] Hiểu tracing, metrics, logs và evaluation

Thực hành:

- [ ] Viết threat model cho hệ thống
- [ ] Thêm secret/PII redaction cần thiết
- [ ] Bảo vệ retrieval bằng authorization filter
- [ ] Phân tách instruction và untrusted content
- [ ] Theo dõi latency, error, token và cost
- [ ] Theo dõi retrieval empty rate và tool success rate
- [ ] Tạo prompt-injection test cases

Definition of Done:

- Có threat model và security checklist trong repository.
- User thuộc tenant A không truy xuất được chunk của tenant B.
- Có audit trail cho hành động quan trọng.

### Tuần 12: System Design và Capstone

Kiến thức:

- [ ] Thiết kế authentication và authorization
- [ ] Thiết kế synchronous, streaming và background job
- [ ] Thiết kế cache và rate limit
- [ ] Thiết kế provider fallback
- [ ] Thiết kế cost budget và observability
- [ ] Trình bày trade-off nhất quán

Thực hành:

- [ ] Hoàn thiện Project 3
- [ ] Viết architecture diagram
- [ ] Viết sequence diagram cho chat, RAG và tool call
- [ ] Viết threat model
- [ ] Viết cost estimate
- [ ] Chạy automated tests và RAG evaluation
- [ ] Chuẩn bị README và demo script
- [ ] Luyện mock interview

Definition of Done:

- Người khác có thể chạy dự án từ README.
- Có test, evaluation report và các quyết định kiến trúc.
- Có thể demo cả happy path, failure path và security control.

## Portfolio Projects

### Project 1: Streaming AI Chat

Tính năng bắt buộc:

- ReactJS chat UI
- Node.js + TypeScript backend
- Streaming response
- Conversation persistence
- Structured output
- Tool calling
- Authentication và ownership check
- Token, cost và latency tracking
- Retry, timeout và rate limiting
- Unit/integration tests

### Project 2: Secure RAG PDF Assistant

Tính năng bắt buộc:

- Upload nhiều PDF
- Background ingestion
- PostgreSQL + pgvector
- Metadata và tenant filtering
- Hybrid retrieval hoặc semantic + keyword comparison
- Citation theo document/page
- Refuse-to-answer khi thiếu bằng chứng
- Evaluation dataset và report
- Prompt-injection tests

### Project 3: Enterprise AI Assistant

Tính năng bắt buộc:

- ReactJS + Node.js, toàn bộ dùng TypeScript
- RAG có citation
- LangGraph.js workflow
- MCP tools/resources
- Human approval cho write action
- Role-based access control
- Audit log
- Provider abstraction
- Tracing, cost dashboard và evaluation
- Docker Compose và tài liệu kiến trúc

## Kiến trúc Capstone dự kiến

```text
ReactJS
   |
Node.js / Fastify API Gateway
   |-- Authentication / Authorization
   |-- Rate Limiting
   |-- Conversation Service
   |-- LangGraph.js Workflow
          |-- RAG / pgvector
          |-- MCP Client / Tools
          |-- Internal APIs
          |-- Human Approval
   |
LLM Provider Adapter
   |-- OpenAI
   |-- Gemini
   |-- Anthropic
   |
Observability / Evaluation / Cost Tracking
```

## Câu hỏi phỏng vấn trọng tâm

- [ ] SSE khác WebSocket thế nào và chọn cái nào cho chat streaming?
- [ ] Streaming giảm total latency hay perceived latency?
- [ ] Structured output khác tool calling thế nào?
- [ ] Làm sao xử lý conversation vượt context window?
- [ ] Làm sao giảm token cost mà vẫn giữ chất lượng?
- [ ] RAG là gì và vì sao cần RAG?
- [ ] Vì sao RAG không loại bỏ hoàn toàn hallucination?
- [ ] Chọn chunk size và overlap dựa trên yếu tố nào?
- [ ] Khi nào dùng pgvector, khi nào dùng vector database riêng?
- [ ] HNSW đánh đổi speed, memory và recall thế nào?
- [ ] Hybrid search và reranking giải quyết vấn đề gì?
- [ ] Làm sao đánh giá một RAG pipeline?
- [ ] Agent khác deterministic workflow thế nào?
- [ ] Làm sao giới hạn cost và số vòng lặp của agent?
- [ ] Làm sao ngăn agent thực hiện hành động nguy hiểm?
- [ ] MCP khác REST API và LLM tool calling thế nào?
- [ ] Làm sao ngăn prompt injection từ PDF hoặc tool result?
- [ ] Làm sao bảo đảm tenant isolation trong retrieval?
- [ ] Cần log gì để debug một câu trả lời AI sai?
- [ ] Thiết kế hệ thống chat tài liệu nội bộ cho doanh nghiệp thế nào?

## Nguyên tắc Security

- API key chỉ tồn tại ở backend hoặc secret manager.
- Mọi dữ liệu từ model, document và tool đều là untrusted input.
- Authorization phải được kiểm tra trong code, không giao cho model quyết định.
- Filter tenant/document permission trước hoặc trong retrieval query.
- Tool có quyền tối thiểu; ưu tiên read-only.
- Write action cần confirmation, idempotency và audit log.
- Không gửi dữ liệu nhạy cảm tới provider khi chưa có chính sách cho phép.
- Không log secret, toàn bộ prompt nhạy cảm hoặc PII không cần thiết.
- Có giới hạn token, thời gian, số vòng lặp và chi phí cho mọi workflow.

## Nguyên tắc Cost Optimization

- Chọn model nhỏ nhất đáp ứng chất lượng.
- Chỉ gửi conversation và retrieved context cần thiết.
- Giảm dữ liệu lặp lại trong prompt.
- Cache deterministic hoặc frequently repeated result khi phù hợp.
- Batch embedding trong ingestion.
- Không embed lại document không thay đổi.
- Giới hạn output token và agent iteration.
- Theo dõi cost theo feature, user, tenant và model.
- Đánh giá chất lượng trước và sau mỗi tối ưu.

## Tài liệu chính thức

- OpenAI API: <https://developers.openai.com/api/docs/>
- OpenAI Streaming: <https://developers.openai.com/api/docs/guides/streaming-responses>
- OpenAI Function Calling: <https://developers.openai.com/api/docs/guides/function-calling>
- OpenAI Structured Output: <https://developers.openai.com/api/docs/guides/structured-outputs>
- Gemini API: <https://ai.google.dev/gemini-api/docs>
- Anthropic API: <https://platform.claude.com/docs/>
- MCP: <https://modelcontextprotocol.io/docs/>
- pgvector: <https://github.com/pgvector/pgvector>
- LangGraph.js: <https://docs.langchain.com/oss/javascript/langgraph/overview>
- OWASP GenAI Security: <https://genai.owasp.org/>

## Current Progress

- Current phase: RAG Ingestion Pipeline
- Current week: Tuần 6
- Current task: So sánh fixed-size, recursive và structure-aware chunking; mở rộng ingestion từ lab sang file upload/PDF parser thật
- Blockers: In-app Browser không có tool callable trong phiên hiện tại; `/api/agent/chat` với Gemini có thể gửi metadata/nội dung file tới provider bên ngoài; auto-apply write/delete chỉ nên dùng với thư mục được allowlist và dữ liệu học tập
- Last updated: 2026-07-05

## Progress Log

### 2026-06-13

- Tạo lộ trình học 12 tuần.
- Chọn ReactJS + FastAPI + PostgreSQL/pgvector làm stack chính.
- Xác định ba dự án portfolio: Streaming Chat, Secure RAG PDF Assistant và Enterprise AI Assistant.
- Cài Python 3.13.5 và tạo virtual environment tại `backend/.venv`.
- Tạo FastAPI project với provider abstraction, fake provider và OpenAI Responses API adapter.
- Tạo `POST /api/chat` và `GET /health`; thêm timeout/error mapping, token usage và latency logging.
- Thêm `.env.example`, giữ API key ở backend và loại `.env` khỏi Git.
- Thêm mock tests cho health, chat success, validation và provider failure.
- Kiểm chứng: `ruff check .` thành công; `pytest -q` có 4 test pass.
- Chưa gọi OpenAI thật vì môi trường chưa có `OPENAI_API_KEY`.
- Task tiếp theo: cấu hình API key cục bộ và chạy smoke request thật, sau đó học token/context window dựa trên response usage.

### 2026-06-13 - Chuyển sang TypeScript end-to-end

- Chuyển định hướng frontend và backend sang TypeScript: ReactJS + Node.js.
- Thay FastAPI/Pydantic bằng Fastify/Zod; giữ nguyên contract `POST /api/chat` và `GET /health`.
- Thay pytest bằng Node.js test runner và chuyển provider abstraction/OpenAI Responses API adapter sang TypeScript.
- Cài npm dependencies; `npm run typecheck`, Node.js test runner với 4 test và `npm run build` đều thành công.
- `npm audit` kiểm tra cả production và development dependencies: không phát hiện lỗ hổng.
- Production dependency audit: không phát hiện lỗ hổng.
- Đã chuyển `.env` sang `LLM_PROVIDER=openai` mà không hiển thị hoặc thay đổi API key.
- OpenAI nhận request nhưng trả `429 insufficient_quota`; cần kích hoạt billing/API credit trước khi hoàn thành smoke test thật.
- Task tiếp theo: dùng Gemini Free Tier cho bài học hiện tại; chỉ quay lại OpenAI khi có API credit.

### 2026-06-13 - Multi-provider và Gemini

- Thêm Google Gen AI SDK chính thức và `GeminiLlmProvider` bằng TypeScript.
- Chuẩn hóa `LlmProvider` để fake, OpenAI và Gemini cùng dùng một contract.
- Factory chọn provider bằng `LLM_PROVIDER`; API route và frontend không phụ thuộc SDK của provider.
- Response và log có thêm trường `provider` để theo dõi request đang dùng nhà cung cấp nào.
- Thêm validation riêng cho `OPENAI_API_KEY` và `GEMINI_API_KEY` theo provider được chọn.
- Thêm mapping cho timeout, rate limit và authentication/permission error của Gemini.
- Cập nhật `.env.example`, README và chuyển `.env` sang `LLM_PROVIDER=gemini`.
- Kiểm chứng: typecheck và build thành công, 8 test pass, `npm audit` không phát hiện lỗ hổng.
- Chưa chạy request Gemini thật vì `GEMINI_API_KEY` trong `.env` đang để trống.
- Task tiếp theo: dán Gemini key vào `.env`, chạy `/api/chat`, xác nhận provider/model/token usage/latency.

### 2026-06-13 - Gemini smoke test thành công

- Xác nhận `.env` đang chọn `LLM_PROVIDER=gemini` và Gemini key đã được cấu hình.
- Chạy lại typecheck, build và 8 automated tests: tất cả thành công.
- `GET /health` trả `ok`; `POST /api/chat` gọi Gemini Free Tier thành công.
- Provider thực tế: `gemini`; model: `gemini-3.5-flash`; latency đo được khoảng 1430 ms.
- Usage của smoke request: 26 input tokens, 4 output tokens và 135 total tokens.
- Bổ sung `thinking_tokens` vào usage response/log để giải thích phần token nội bộ của model.
- Task tiếp theo: học token/tokenizer/context window và thử các prompt có độ dài khác nhau để so sánh usage.

### 2026-06-13 - Token và context window lab

- Thêm script tái sử dụng `npm run learn:tokens` và tài liệu `backend/docs/01_TOKENS_AND_CONTEXT.md`.
- Dùng Gemini `countTokens` để đo input trước request và usage metadata để đo usage thực tế sau request.
- Model `gemini-3.5-flash` báo input context limit 1,048,576 token và output limit 65,536 token tại thời điểm kiểm tra.
- Prompt tiếng Anh ngắn: 43 ký tự, 8 từ nhưng 11 token; xác nhận token không đồng nhất với từ hoặc ký tự.
- Prompt tiếng Việt ngắn: 62 ký tự, 13 từ và 15 token; ngôn ngữ ảnh hưởng tokenization.
- Prompt chứa TypeScript: 86 ký tự, 15 từ và 26 token; punctuation/code làm thay đổi token count.
- Prompt dài: 3,516 ký tự, 648 từ và 771 input token; input tăng kéo theo token usage và latency tăng.
- Billed input cao hơn preflight count 11 token trong mọi mẫu vì request generate có thêm system instruction.
- Thinking model dùng khoảng 188-190 internal thinking tokens dù visible output chỉ 6-8 token; không thể ước tính total usage chỉ từ text hiển thị.
- Latency quan sát được khoảng 1.5-2.2 giây; prompt dài nhất chậm hơn các prompt ngắn.
- Kiểm chứng: typecheck, build và 8 automated tests thành công; token lab chạy 4 request Gemini thật.
- Task tiếp theo: thử system instruction, temperature và `maxOutputTokens` để hiểu cách chúng kiểm soát hành vi/output.

### 2026-06-13 - Generation controls lab

- Thêm `npm run learn:generation` và tài liệu `backend/docs/02_GENERATION_CONTROLS.md`.
- Cùng user prompt, system instruction cho người mới tạo ví dụ nhà hàng; instruction cho senior tập trung contract, boundary và failure mode.
- Temperature 0 tạo `OmniFind`; hai lần temperature 1.5 tạo `DocuSeek` và `Omni`, xác nhận temperature cao tăng khả năng đa dạng nhưng không phải cam kết determinism.
- `maxOutputTokens=12` dừng với `MAX_TOKENS` và cắt câu sau 8 output token.
- `maxOutputTokens=100` vẫn dừng với `MAX_TOKENS` sau 96 output token vì câu trả lời chưa hoàn tất trong budget.
- Stop sequence `STOP_MARKER` trả visible output `alpha`; marker và phần sau bị loại, finish reason là `STOP`.
- Tắt thinking trong lab để quan sát output budget trực tiếp; thinking token cần được tính riêng khi bật tự động.
- Gặp giới hạn Gemini Free Tier 5 request/phút; bổ sung pacing 13 giây và một lần retry sau 429.
- Kiểm chứng: generation lab hoàn thành 8 request thật; typecheck, build và 8 automated tests thành công.
- Hoàn thành toàn bộ kiến thức và thực hành Tuần 1.
- Task tiếp theo: học HTTP streaming và thiết kế stream event contract cho Fastify + ReactJS.

### 2026-06-18 - Backend streaming và event contract

- Thiết kế stream event contract gồm `start`, `delta`, `usage`, `end`, `error`.
- Thêm `LlmProvider.stream()` để route không phụ thuộc trực tiếp SDK của Gemini/OpenAI.
- Thêm `POST /api/chat/stream` trả `text/event-stream` qua Fastify.
- Gemini dùng `generateContentStream`; fake/OpenAI có stream adapter tương thích contract.
- Thêm `StreamEventParser` để client buffer event theo boundary `\\n\\n` thay vì giả định network chunk là event hoàn chỉnh.
- Thêm test parser với chunk bị chia tùy ý, test route streaming thành công và test error event.
- Chuyển model lab sang `gemini-2.5-flash` vì `gemini-3.5-flash` trả `503 UNAVAILABLE` khi high demand; model 2.5 streaming ổn định hơn cho bài học.
- Smoke test thật qua `/api/chat/stream` thành công với event `start -> delta -> usage -> end`.
- Usage smoke test: provider `gemini`, model `gemini-2.5-flash`, 26 input tokens, 4 output tokens, 65 thinking tokens, 95 total tokens, latency khoảng 1117 ms.
- Thêm tài liệu song ngữ `backend/docs/03_STREAMING_CHAT.md`.
- Kiểm chứng: typecheck, build và 11 automated tests thành công.
- Task tiếp theo: tạo ReactJS UI đọc streaming `fetch`, hiển thị delta và thêm Stop generating bằng `AbortController`.

### 2026-06-18 - React streaming UI

- Tạo frontend ReactJS + TypeScript bằng Vite tại `frontend/`.
- Thêm UI chat streaming với textarea, nút Send, nút Stop generating, trạng thái `idle/streaming/done/error/stopped`, output partial và usage metrics.
- Dùng `fetch` POST tới `/api/chat/stream`, đọc `ReadableStream`, decode chunk bằng `TextDecoder` và parse event bằng `StreamEventParser`.
- Dùng `AbortController` để hủy request khi người dùng bấm Stop; cùng pattern này sẽ dùng cho cleanup khi component unmount ở bước polish sau.
- Thêm Vite dev proxy `/api -> http://127.0.0.1:8000` để frontend không cần biết API key và không cần CORS trong dev.
- Thêm frontend tests cho parser khi chunk bị chia tùy ý, `streamChat` nhận stream event và non-2xx error.
- Cập nhật README root và thêm `frontend/README.md` với cách chạy backend/frontend.
- Kiểm chứng frontend: typecheck thành công, 3 automated tests pass, production build thành công, production dependency audit không phát hiện lỗ hổng.
- Kiểm chứng backend lại: typecheck thành công, 11 automated tests pass, build thành công.
- Visual QA bằng in-app Browser chưa thực hiện được vì Browser runtime lỗi quyền sandbox; cần kiểm thử thủ công tại `http://127.0.0.1:5173` hoặc chạy lại khi Browser hoạt động.
- Task tiếp theo: manual/visual QA UI streaming, sau đó bắt đầu lưu conversation history.

### 2026-06-18 - Filesystem tool service cho agent

- Thêm filesystem tool layer trong backend để chuẩn bị cho Agent/Tool Calling.
- Cấu hình allowlist bằng `FILE_TOOL_ALLOWED_ROOTS`, hiện trỏ tới `E:\Project\3sdesign`.
- Bật có chủ đích `FILE_TOOL_ALLOW_WRITE=true` và `FILE_TOOL_ALLOW_DELETE=true` theo yêu cầu, nhưng vẫn giới hạn trong allowlist.
- Thêm các route nền: `GET /api/files/roots`, `POST /api/files/list`, `/read`, `/search`, `/write`, `/delete`.
- Thêm path guard: mọi path được resolve và phải nằm trong allowed root; path traversal như `..\outside.txt` bị chặn.
- Write/delete được chặn nếu chưa bật env flag; delete yêu cầu `confirmation: "DELETE"` và không cho xóa chính allowed root.
- Sửa lỗi bảo mật trong config: không dùng `z.coerce.boolean()` cho env boolean vì chuỗi `"false"` có thể bị hiểu thành truthy.
- Thêm tests filesystem: list/read/search, chặn path ngoài root, chặn write khi chưa bật, write/delete khi bật.
- Xác minh thực tế bằng Fastify inject: backend thấy root `E:\Project\3sdesign`, write/delete enabled và list root trả 24 entries.
- Thêm tài liệu song ngữ `backend/docs/06_FILESYSTEM_TOOLS.md`.
- Kiểm chứng: backend typecheck, 15 automated tests và build đều thành công.
- Task tiếp theo: expose các filesystem operations này thành LLM tools để model có thể đề xuất `list/read/search/write/delete`, nhưng backend vẫn giữ quyền thực thi và confirmation.

### 2026-06-18 - File Agent UI cho tool calling

- Thêm UI tab `File Agent` trong React app bên cạnh tab `Streaming Chat`.
- Thêm frontend API helper `frontend/src/api/file-agent.ts` cho `POST /api/agent/chat`, `GET /api/agent/pending` và `POST /api/agent/approve`.
- UI File Agent cho phép nhập prompt, chạy agent, xem answer, xem tool calls, xem pending write/delete actions và approve action trực tiếp.
- Pending panel hiển thị `toolName`, thời điểm tạo, arguments JSON và nút `Approve` để thực thi action đã được backend giữ lại.
- Giữ human-in-the-loop cho write/delete: LLM chỉ đề xuất action, backend tạo pending action, người dùng duyệt trên UI rồi mới thực thi.
- Thêm tests frontend cho file-agent API helper: chat, pending list, approve và backend detail error.
- Kiểm chứng frontend: `npm run typecheck` thành công, `npm test` 7 tests pass, `npm run build` thành công.
- Visual QA bằng in-app Browser vẫn chưa thực hiện được vì Browser runtime lỗi quyền sandbox `CreateProcessAsUserW failed: 5`.
- Lưu ý bảo mật: khi dùng Gemini agent thật, tool result như tên file, search result hoặc nội dung file có thể được gửi tới Gemini; chỉ nên test với thư mục học tập hoặc dữ liệu được phép chia sẻ.
- Task tiếp theo: chạy manual QA bằng backend + frontend local, thử một prompt tạo file nhỏ, approve trên UI, rồi thêm audit log cho tool call.

### 2026-06-18 - Bật File Agent auto-apply write/delete

- Thêm cấu hình `FILE_AGENT_AUTO_APPLY_WRITES` vào backend config, `.env.example` và bật `true` trong `.env` local theo yêu cầu người dùng.
- Khi auto-apply bật, tool `write_file` và `delete_file` được thực thi ngay trong agent loop thay vì tạo pending action chờ approve.
- Vẫn giữ rào chắn `FILE_TOOL_ALLOWED_ROOTS`, `FILE_TOOL_ALLOW_WRITE`, `FILE_TOOL_ALLOW_DELETE`, `FILE_TOOL_MAX_FILE_BYTES` và path traversal guard; agent không được ghi/xóa ngoài allowed root.
- Response `/api/agent/chat` có thêm `executedActions` để frontend hiển thị các file action đã được chạy.
- UI File Agent hiển thị trạng thái auto-apply và danh sách `Executed actions`; pending panel chỉ còn là fallback nếu tắt auto-apply sau này.
- Giữ endpoint pending/approve để không phá contract cũ và để dễ quay lại human approval khi cần.
- Thêm test config xác nhận `FILE_AGENT_AUTO_APPLY_WRITES=true/false` được parse đúng boolean, tránh lỗi chuỗi `"false"` bị hiểu nhầm thành truthy.
- Kiểm chứng: backend `npm run typecheck`, `npm test` 16 tests pass, backend `npm run build`; frontend `npm run typecheck`, `npm test` 7 tests pass, frontend `npm run build`.
- Task tiếp theo: manual QA agent auto-apply bằng prompt tạo/sửa/xóa file nhỏ trong thư mục allowlist, sau đó thêm audit log cho mọi tool call.

### 2026-06-21 - File Agent audit log và QA auto-apply an toàn

- Thêm audit log in-memory cho `FileAgentService`, ghi nhận `toolName`, args đã redact, trạng thái `pending/success/error`, thời điểm tạo/hoàn tất, `autoApplied`, kết quả tóm tắt hoặc lỗi.
- Thêm endpoint `GET /api/agent/audit` để đọc audit log và nối frontend File Agent UI với panel `Tool audit`.
- Redact `content` trong tool args và nội dung file trong result để audit log không lưu nguyên văn dữ liệu file nhạy cảm.
- Refactor `FileAgentService` cho phép inject fake Gemini client trong test, nhờ đó kiểm chứng agent loop/tool calling mà không cần network hoặc API key thật.
- Kiểm chứng auto-apply bằng thư mục tạm allowlist an toàn: fake model gọi `write_file`, backend tạo `notes/agent-qa.txt`, response có `executedActions`, audit có entry `success`.
- Thêm test malformed arguments: thiếu `content` bị chặn với lỗi `Missing required argument: content` và audit ghi `error`.
- Thêm test unauthorized call: path `..\outside.txt` bị chặn bởi allowlist guard và audit ghi `error`.
- Cập nhật frontend API helper `listToolAudit()` và test tương ứng.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 19 tests pass, `npm run build`.
- Kiểm chứng frontend: `npm run typecheck`, `npm test` 8 tests pass, `npm run build`.
- Chưa chạy visual QA bằng in-app Browser vì phiên hiện tại không có Browser automation tool callable; production build đã xác nhận bundle hợp lệ.
- Task tiếp theo: học JSON Schema, phân biệt JSON mode/schema-constrained output/structured output/tool calling, sau đó parse structured output bằng Zod.

### 2026-06-27 - Structured output và Zod parsing

- Học và ghi chú sự khác nhau giữa JSON Schema, JSON mode, schema-constrained output, structured output và tool calling trong `backend/docs/04_STRUCTURED_OUTPUT.md`.
- Thêm module `backend/src/structured/support-ticket.ts` để build prompt support ticket, parse JSON object từ model text và validate runtime bằng Zod.
- Thêm endpoint `POST /api/structured/support-ticket` trả typed support ticket khi output hợp lệ và trả `422` khi model trả malformed JSON hoặc JSON sai domain schema.
- Parser chấp nhận JSON thuần hoặc JSON bị bọc trong markdown fence, nhưng vẫn coi toàn bộ model output là untrusted input.
- Thêm tests cho fenced JSON parsing, extraction endpoint thành công, malformed JSON và schema mismatch.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 23 tests pass, `npm run build`.
- Task tiếp theo: tạo tool thời tiết giả lập bằng Zod schema, sau đó nối vào tool-calling flow có validation và test.

### 2026-06-27 - Fake weather tool calling

- Thêm read-only tool `get_weather` vào Gemini function declarations của `FileAgentService`.
- Tạo module `backend/src/agent/weather-tool.ts` với Zod schema cho arguments: `location` bắt buộc và `unit` chỉ được là `celsius` hoặc `fahrenheit`.
- Tool thời tiết là fake/deterministic, không gọi API bên ngoài, phù hợp cho bài học tool calling và automated tests không cần network.
- Backend validate arguments trước khi execute; malformed arguments từ model bị reject và audit log ghi trạng thái `error`.
- Thêm tài liệu song ngữ `backend/docs/05_TOOL_CALLING.md` giải thích tool calling, fake weather tool, validation boundary và khác biệt read-only/write tool.
- Thêm tests cho tool call thành công, malformed weather arguments và audit log.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 25 tests pass, `npm run build`.
- Task tiếp theo: tạo tool đọc trạng thái đơn hàng bằng Zod schema và test authorization/validation trước khi gọi tool.

### 2026-06-27 - Order status tool calling

- Thêm read-only tool `get_order_status` vào Gemini function declarations của `FileAgentService`.
- Tạo module `backend/src/agent/order-tool.ts` với Zod schema cho `orderId` dạng `ord_...` và fake order store deterministic.
- Backend kiểm tra ownership bằng `currentUserId` của service, không tin `userId` do model có thể gửi trong tool arguments.
- Tool trả trạng thái đơn hàng chỉ khi order thuộc user hiện tại; order của user khác bị chặn với authorization error.
- Cập nhật tài liệu song ngữ `backend/docs/05_TOOL_CALLING.md` với phần Order Status Tool và validation/authorization boundary.
- Thêm tests cho order thuộc user hiện tại, order thuộc user khác, malformed `orderId` và audit log.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 28 tests pass, `npm run build`.
- Task tiếp theo: tạo tool tạo support ticket với confirmation/idempotency cho write action và test validation.

### 2026-06-27 - Support ticket write tool

- Thêm write tool `create_support_ticket` vào Gemini function declarations của `FileAgentService`.
- Tạo module `backend/src/agent/support-ticket-tool.ts` với Zod schema cho ticket proposal, confirmation literal `CREATE_TICKET` và fake in-memory support ticket store.
- Backend validate proposal trước khi tạo pending action; malformed proposal bị reject và audit log ghi `error`.
- Tool tạo support ticket luôn yêu cầu approval, không auto-apply theo cấu hình file tool; backend chỉ thêm `confirmation: "CREATE_TICKET"` sau khi approve.
- Thêm `idempotencyKey` để retry cùng một ticket không tạo bản ghi trùng; store trả lại cùng `ticketId` với `deduplicated: true`.
- Audit log redact `customerEmail` và `summary` để tránh lưu PII/nội dung ticket nhạy cảm.
- Cập nhật tài liệu song ngữ `backend/docs/05_TOOL_CALLING.md` với phần Support Ticket Tool, confirmation và idempotency.
- Thêm tests cho pending approval, approve tạo ticket, idempotency dedupe, malformed proposal và audit log.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 32 tests pass, `npm run build`.
- Hoàn thành toàn bộ thực hành Tuần 3 về structured output và tool calling.
- Task tiếp theo: bắt đầu Tuần 4, thiết kế bảng conversation/message và lưu conversation trong PostgreSQL.

### 2026-06-28 - Conversation/message schema và persistence contract

- Thiết kế schema PostgreSQL cho `conversations` và `conversation_messages` tại `backend/src/conversations/schema.sql`.
- Tách `conversations` làm thread metadata/owner và `conversation_messages` làm từng message theo thứ tự thời gian.
- Thêm index `(user_id, updated_at DESC)` để list conversation theo user và `(conversation_id, created_at ASC)` để lấy history đúng thứ tự.
- Lưu provider, model và token usage trên assistant message để chuẩn bị tính cost theo request/user.
- Thêm `ConversationRepository` contract và `InMemoryConversationRepository` để test persistence flow không cần PostgreSQL runtime.
- Nối optional `conversationRepository` vào `POST /api/chat`: request mới tạo conversation, request có `conversationId` append vào conversation nếu đúng owner.
- Backend không tin `conversationId` trần từ client; kiểm tra `userId` ownership trước khi append message và trả `404` nếu conversation không thuộc user hiện tại.
- Thêm tài liệu `backend/docs/08_CONVERSATION_PERSISTENCE.md` mô tả schema, trust boundary và bước tiếp theo.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 35 tests pass, `npm run build`.
- Chưa hoàn tất PostgreSQL runtime thật vì project chưa có driver/Drizzle/Docker Compose cho database; checklist phần lưu PostgreSQL để `[~]`.
- Task tiếp theo: thêm PostgreSQL repository implementation bằng `pg` hoặc Drizzle, cấu hình connection env, chạy migration và test conversation persistence với database thật.

### 2026-06-28 - PostgreSQL conversation repository

- Cài `pg` và `@types/pg`; audit npm không phát hiện lỗ hổng.
- Thêm `PostgresConversationRepository` tại `backend/src/conversations/postgres-repository.ts`.
- Repository tạo conversation, kiểm tra ownership bằng `WHERE id = $1 AND user_id = $2`, append message và cập nhật `conversations.updated_at`.
- Thêm `runConversationMigrations()` dùng schema idempotent `CREATE TABLE IF NOT EXISTS` và `CREATE INDEX IF NOT EXISTS`.
- Nối server với PostgreSQL khi có `DATABASE_URL`; hỗ trợ `DATABASE_SSL` và `DATABASE_RUN_MIGRATIONS`.
- Cập nhật `.env.example` với cấu hình database mẫu.
- Thêm tests `backend/tests/conversation-postgres.test.ts` cho migration SQL, parameter binding, ownership query và mapping usage metadata.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với cách bật persistence thật.
- Kiểm chứng backend: `npm run typecheck`, `npm test` 40 tests pass, `npm run build`.
- Chưa chạy integration test với PostgreSQL container thật; hiện kiểm chứng bằng fake queryable để automated suite không phụ thuộc database local.
- Task tiếp theo: học sliding window/truncation/summarization/compaction và chỉ gửi history cần thiết cho model.

### 2026-06-28 - Chuẩn bị PostgreSQL thật và smoke test

- Thêm `docker-compose.yml` ở root để chạy PostgreSQL 16 local với database `ai_learning`.
- Thêm script `npm run smoke:conversation-db` tại backend để chạy migration, gửi 2 request `/api/chat`, xác nhận 4 message được persist và wrong-owner bị chặn `404`.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với lệnh chạy Docker Compose và smoke test.
- Tạm giữ checklist `Lưu conversation trong PostgreSQL` ở trạng thái `[~]` vì chưa smoke test được với database runtime thật.
- Kiểm chứng code không cần DB thật: `npm run typecheck`, `npm test` 40 tests pass, `npm run build`.
- Thử chạy `docker --version` nhưng máy báo không có lệnh `docker`.
- Thử chạy `wsl docker --version` để dùng Docker trong WSL nhưng Windows báo WSL chưa có distro được cài trong môi trường hiện tại.
- Kiểm tra `psql`, `pg_isready` và Windows service `postgresql*` nhưng không thấy PostgreSQL local runtime có sẵn.
- Thử chạy `npm run smoke:conversation-db`; script dừng đúng guard vì chưa có `DATABASE_URL`.
- Vấn đề còn lại: cần cài Docker Desktop hoặc PostgreSQL local, sau đó chạy `docker compose up -d postgres` hoặc cung cấp `DATABASE_URL` tới PostgreSQL thật.
- Task tiếp theo: sau khi có Docker/PostgreSQL runtime trong Windows hoặc WSL, chạy `docker compose up -d postgres` từ root repo và `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning npm run smoke:conversation-db`, rồi mới đánh dấu `[x]`.

### 2026-07-04 - Sliding window context cho conversation history

- Kiểm tra lại PostgreSQL runtime thật: `docker` và `psql` vẫn chưa có trong PATH, không thấy Windows service `postgresql*`; smoke test database thật tiếp tục bị chặn bởi môi trường.
- Giữ checklist `Lưu conversation trong PostgreSQL` ở trạng thái `[~]` vì repository/migration/smoke script đã có nhưng chưa chạy được với runtime thật.
- Thêm `backend/src/conversations/context.ts` để chọn history bằng sliding window: mặc định tối đa 12 message gần nhất, budget history 2,000 estimated token và truncate từng message quá dài.
- `/api/chat` giờ đọc các message cũ của conversation trước khi append message mới, render history đã cắt gọn vào prompt, rồi mới gọi provider.
- History được đóng trong `<conversation_history>` và ghi rõ là untrusted conversation content, không phải system instruction.
- Message gốc vẫn được lưu nguyên vào repository; chỉ prompt gửi sang provider mới chứa history đã giới hạn.
- Thêm test route xác nhận request thứ hai trong cùng conversation gửi history cũ cho provider.
- Thêm `backend/tests/conversation-context.test.ts` kiểm chứng giữ message gần nhất theo đúng thứ tự, bỏ message cũ khi vượt budget và render current user message tách khỏi history.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với context window policy và bước tiếp theo là summarization/compaction.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 44 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ thuộc sandbox user khác gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu sliding window, truncation, summarization và compaction`, `Chỉ gửi history cần thiết cho model` và `Thêm giới hạn message/context`.
- Task tiếp theo: học retry với exponential backoff/jitter và thêm retry policy có test cho provider call.

### 2026-07-04 - Cài Docker Engine trong WSL và smoke test PostgreSQL thật

- Xác nhận Ubuntu WSL đang chạy với user `duyunh`, Ubuntu 26.04 và WSL2.
- Cài Docker Engine trong Ubuntu WSL theo Docker apt repository chính thức: `docker-ce`, `docker-ce-cli`, `containerd.io`, `docker-buildx-plugin` và `docker-compose-plugin`.
- Bật Docker daemon trong WSL và thêm user `duyunh` vào group `docker`.
- Kiểm chứng Docker: `docker --version` trả Docker 29.6.1, `docker compose version` trả v5.3.0 và `docker run --rm hello-world` thành công.
- Chạy `docker compose up -d postgres` từ `/mnt/e/Project/AI-learning`; container `ai_learning_postgres` publish port `5432` và healthcheck chuyển sang `healthy`.
- Chạy smoke test thật từ `backend/` với `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning` và `DATABASE_RUN_MIGRATIONS=true`.
- Smoke test conversation DB thành công: migration chạy được, 2 request `/api/chat` persist 4 message theo thứ tự `user, assistant, user, assistant`, và wrong-owner request bị chặn `404`.
- Đánh dấu checklist `Lưu conversation trong PostgreSQL` thành `[x]`.
- Task tiếp theo vẫn là học retry với exponential backoff/jitter và thêm retry policy có test cho provider call.

### 2026-07-04 - Retry với exponential backoff và jitter

- Thêm `retryable` metadata vào `LlmProviderError` để phân biệt lỗi tạm thời với lỗi không nên retry.
- Đánh dấu timeout, rate limit và một số lỗi provider 5xx tạm thời là retryable trong Gemini/OpenAI adapter; auth, permission và insufficient quota vẫn fail nhanh.
- Thêm `backend/src/providers/retry.ts` với retry policy dùng exponential backoff, max delay và jitter.
- Thêm cấu hình `.env`: `LLM_RETRY_MAX_ATTEMPTS`, `LLM_RETRY_BASE_DELAY_MS`, `LLM_RETRY_MAX_DELAY_MS` và `LLM_RETRY_JITTER_RATIO`.
- Nối retry policy vào `/api/chat`; khi retry, backend log attempt hiện tại, attempt kế tiếp và delay dự kiến.
- Thêm `backend/tests/retry.test.ts` kiểm chứng tính delay, retry lỗi retryable tới khi thành công và không retry lỗi non-retryable.
- Thêm route test xác nhận `/api/chat` retry provider failure tạm thời 2 lần rồi trả answer thành công ở lần thứ 3.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với ghi chú retry policy.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 49 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ thuộc sandbox user khác gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu retry với exponential backoff và jitter`.
- Task tiếp theo: học rate limiting và thêm rate limit theo user cho chat endpoint.

### 2026-07-05 - Rate limiting theo user cho chat endpoint

- Thêm `backend/src/rate-limit.ts` với in-memory fixed-window rate limiter theo key, trả quyết định `allowed`, `remaining`, `resetAt` và `retryAfterMs`.
- Thêm cấu hình `.env`: `CHAT_RATE_LIMIT_MAX_REQUESTS` và `CHAT_RATE_LIMIT_WINDOW_MS`; mặc định 20 request mỗi 60 giây cho mỗi user.
- Nối limiter vào `/api/chat` sau validation request nhưng trước khi tạo conversation, append message hoặc gọi provider, để request bị chặn không tốn token và không ghi dữ liệu rác.
- Nối cùng limiter vào `/api/chat/stream` để streaming endpoint không bypass được quota.
- Khi vượt quota, backend trả `429` với `retry_after_ms`, header `Retry-After`, `RateLimit-Limit`, `RateLimit-Remaining` và `RateLimit-Reset`.
- Thêm tests cho bucket riêng theo user, reset window, route `429`, stream endpoint bị limit và request bị limit không persist message mới.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với phần rate limiting và ghi chú production nhiều instance nên dùng shared store như Redis.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 56 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu rate limiting` và `Thêm rate limit theo user`.
- Task tiếp theo: học model routing, fallback và caching.

### 2026-07-05 - Model routing, fallback và cache cho chat

- Thêm `backend/src/providers/routing.ts` với `RoutingLlmProvider` bọc primary provider, optional fallback provider và in-memory response cache.
- Thêm `InMemoryLlmResponseCache` có TTL; cache hit trả bản sao kết quả để tránh caller sửa object đã lưu.
- Fallback chỉ chạy khi primary ném `LlmProviderError` có `retryable: true`; lỗi auth, permission, quota/config sai hoặc validation không fallback để không che dấu lỗi cần sửa.
- Cập nhật provider factory: `LLM_PROVIDER` là primary, `LLM_FALLBACK_PROVIDER` là fallback optional, `CHAT_CACHE_TTL_MS` bật/tắt cache cho `generate()`.
- Cập nhật `.env.example` với `LLM_FALLBACK_PROVIDER=none` và `CHAT_CACHE_TTL_MS=0`.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với trade-off routing/cache, ghi chú cache key đang dựa trên rendered prompt và stream endpoint chưa dùng cache/fallback để tránh phá perceived latency.
- Thêm `backend/tests/provider-routing.test.ts` kiểm chứng cache TTL, fallback với lỗi retryable, không fallback với lỗi non-retryable và cache kết quả fallback.
- Cập nhật config tests để kiểm chứng fallback provider cần credential và factory bọc provider khi bật fallback/cache.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 62 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu model routing, fallback và caching`.
- Task tiếp theo: theo dõi cost theo request và user.

### 2026-07-05 - Cost tracking theo request và user

- Thêm `backend/src/cost.ts` để ước tính provider cost từ token usage và pricing cấu hình trong env, lưu bằng micro-USD integer để cộng dồn ổn định.
- Thêm cấu hình `.env`: `OPENAI_INPUT_USD_PER_1M_TOKENS`, `OPENAI_OUTPUT_USD_PER_1M_TOKENS`, `OPENAI_THINKING_USD_PER_1M_TOKENS`, `GEMINI_INPUT_USD_PER_1M_TOKENS`, `GEMINI_OUTPUT_USD_PER_1M_TOKENS` và `GEMINI_THINKING_USD_PER_1M_TOKENS`.
- Không hard-code giá provider vì pricing thay đổi theo thời gian; mặc định là 0 và người chạy điền giá hiện tại từ billing docs của provider.
- `POST /api/chat` trả thêm `estimated_cost_usd` và `cache_hit`; cache hit vẫn trả usage để quan sát nhưng estimated cost của request hiện tại bằng 0.
- Assistant message lưu thêm `estimated_cost_usd_micros`; schema có `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` để migration idempotent với database cũ.
- Thêm `GET /api/users/:userId/cost-summary` để tổng hợp request count, input/output/thinking/total tokens và estimated cost theo user từ persisted conversations.
- Streaming chat cũng persist estimated cost khi có repository và usage event.
- Cập nhật `backend/docs/08_CONVERSATION_PERSISTENCE.md` với phần cost tracking, cost summary endpoint và lưu ý cache hit không tính chi phí provider mới.
- Thêm tests cho cost formula, parse config pricing, route response cost, cache hit cost bằng 0, Postgres cost column và summary query.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 67 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `Theo dõi cost theo request và user`.
- Task tiếp theo: hoàn thiện Project 1.

### 2026-07-05 - Hoàn thiện Project 1 Streaming AI Chat

- Hoàn thiện UI Streaming Chat thành bề mặt demo Project 1: hiển thị conversation id, provider/model, token usage, latency và estimated request cost.
- Frontend gửi rõ `userId=demo-user` khi gọi `/api/chat/stream` để cost summary và ownership/persistence flow có user ổn định.
- Thêm API client `frontend/src/api/cost-summary.ts` và panel `Project telemetry` để đọc `GET /api/users/:userId/cost-summary` khi backend có conversation persistence.
- Backend stream usage event trả thêm `estimatedCostUsd`, giúp UI hiển thị cost cho streaming response.
- Cập nhật frontend tests cho stream request body có `userId`, usage event có `estimatedCostUsd` và cost summary API.
- Cập nhật README root/backend/frontend thành tài liệu Project 1: tính năng, cách verify, production knobs, cost summary endpoint và demo surface.
- Kiểm chứng backend: `npm run typecheck` thành công; `npm test` có 67 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Kiểm chứng frontend: `npm run typecheck`, `npm test` có 11 test pass và `npm run build` thành công.
- Thử start dev server trong nền bằng `Start-Process` nhưng process không giữ lại trong phiên shell hiện tại; chạy trực tiếp `npm run dev` hoạt động, nên demo local cần mở 2 terminal thủ công nếu muốn xem UI.
- Hoàn thành task `Hoàn thiện Project 1`.
- Task tiếp theo: bắt đầu Tuần 5, chạy PostgreSQL + pgvector bằng Docker và học embedding/vector dimension.

### 2026-07-05 - Bắt đầu Tuần 5: embedding dimension và pgvector schema

- Đổi `docker-compose.yml` từ `postgres:16-alpine` sang `pgvector/pgvector:pg16` để PostgreSQL có sẵn extension pgvector.
- Thêm `backend/src/embeddings/deterministic.ts` để tạo embedding deterministic 4 chiều phục vụ lab không cần gọi provider thật.
- Thêm hàm tính cosine similarity, cosine distance, dot product và L2 distance; test xác nhận mismatch dimension bị reject.
- Thêm `backend/src/vector/schema.ts` với `CREATE EXTENSION IF NOT EXISTS vector`, bảng `rag_documents`, bảng `rag_document_chunks`, metadata JSON, tenant/user ownership và cột `embedding vector(4)`.
- Schema có index `(tenant_id, owner_user_id)` để nhấn mạnh authorization/metadata filter trước retrieval và HNSW index `embedding vector_cosine_ops` để chuẩn bị approximate search.
- Thêm `npm run smoke:pgvector` qua `backend/src/scripts/pgvector-smoke.ts`: tạo extension/schema, insert chunk + embedding, query top-k bằng cosine distance `<=>` và kiểm chứng pgvector reject vector sai dimension.
- Thêm tài liệu `backend/docs/09_EMBEDDINGS_AND_PGVECTOR.md` giải thích embedding dimension, cosine/dot/L2, schema, lệnh Docker và smoke test.
- Cập nhật README root/backend với hướng dẫn pgvector lab.
- Kiểm chứng không cần DB thật: `npm run typecheck` thành công; `npm test` có 71 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Thử `docker --version`: Windows không có lệnh `docker`; thử `wsl docker --version` và `wsl -l -v`: WSL báo không có distro được cài trong phiên hiện tại.
- Thử `npm run smoke:pgvector`: script dừng đúng guard vì chưa có `DATABASE_URL`; chưa thể đánh dấu `Chạy PostgreSQL + pgvector bằng Docker` là hoàn tất thật.
- Hoàn thành kiến thức `Hiểu embedding và vector dimension` và `Hiểu cosine similarity, cosine distance, dot product và L2`.
- Task tiếp theo: bật Docker/WSL hoặc PostgreSQL pgvector runtime thật, chạy `docker compose up -d postgres`, đặt `DATABASE_URL`, rồi chạy `npm run smoke:pgvector`.

### 2026-07-05 - Vector repository, metadata filter và top-k retrieval

- Xác nhận lại runtime hiện tại: Windows không có lệnh `docker`; `wsl docker --version` báo WSL chưa có distro được cài trong phiên này, nên chưa thể chạy smoke pgvector thật.
- Thêm `backend/src/vector/repository.ts` với `VectorRepository`, `InMemoryVectorRepository` và `PostgresVectorRepository`.
- Repository lưu document metadata, chunk content, metadata JSON và embedding; `searchTopK()` bắt buộc nhận `tenantId`, `ownerUserId`, query embedding và `topK`.
- Query PostgreSQL dùng `embedding <=> $1::vector`, filter `tenant_id`, `owner_user_id` và metadata trước khi sort/trả context.
- Thêm `backend/tests/vector-repository.test.ts` kiểm chứng lưu embedding kèm metadata, ranking top-k theo cosine distance, tenant/user isolation và metadata filter trong SQL.
- Cập nhật `backend/docs/09_EMBEDDINGS_AND_PGVECTOR.md` bằng tiếng Việt có dấu, thêm phần exact vs approximate nearest-neighbor, HNSW, IVFFlat và metadata filtering.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 74 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu exact và approximate nearest-neighbor search`, `Hiểu HNSW và IVFFlat ở mức sử dụng`, `Hiểu metadata filtering`, `Lưu embedding kèm metadata` và `Truy vấn top-k bằng cosine distance`.
- Task tiếp theo: so sánh kết quả retrieval với các query khác nhau; khi có Docker/PostgreSQL runtime thật thì chạy `npm run smoke:pgvector` và `EXPLAIN` để xem HNSW query plan.

### 2026-07-05 - So sánh retrieval với nhiều query

- Thêm `backend/src/vector/retrieval-lab.ts` để seed bốn chunk chủ đề `vector`, `backend`, `frontend` và `security`, rồi chạy nhiều query top-k trên `InMemoryVectorRepository`.
- Thêm script `npm run learn:retrieval` qua `backend/src/scripts/retrieval-comparison-lab.ts` để in query, topic, distance và content của từng match.
- Chạy lab ban đầu với embedding deterministic 4 chiều cho thấy collision làm ranking sai nghĩa ở một số query; tăng dimension riêng cho lab offline lên 32 để giảm collision và quan sát ranking rõ hơn.
- Cập nhật `backend/docs/09_EMBEDDINGS_AND_PGVECTOR.md` với lệnh lab, ý nghĩa distance, cảnh báo nearest vector không đảm bảo đúng nhất và ghi chú production phải dùng đúng dimension của provider.
- Thêm test kiểm chứng mỗi query lab trả top topic tương ứng và kết quả được sort theo distance tăng dần.
- Kiểm chứng: `npm run learn:retrieval` chạy thành công; `npm run typecheck` thành công; `npm test` có 75 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `So sánh kết quả với các query khác nhau`.
- Task tiếp theo: khi có Docker/PostgreSQL runtime thật, chạy `npm run smoke:pgvector` và thêm `EXPLAIN` để xem HNSW query plan.

### 2026-07-05 - Smoke pgvector thật và query plan

- Xác nhận user đã khởi chạy pgvector bằng WSL Docker; backend Windows kết nối được qua `127.0.0.1:5432`.
- Thêm `backend/src/vector/query-plan.ts` để build SQL `EXPLAIN (ANALYZE, BUFFERS, COSTS, VERBOSE)` cho query retrieval có tenant/user filter và optional metadata filter.
- Cập nhật `backend/src/scripts/pgvector-smoke.ts` để sau khi query top-k sẽ in query plan.
- Thêm test kiểm chứng SQL `EXPLAIN` có filter `tenant_id`, `owner_user_id`, metadata filter và `ORDER BY embedding <=> $1::vector`.
- Chạy smoke thật với `DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning`: tạo extension/schema, insert chunks, query top-k và pgvector reject vector sai dimension.
- Kết quả top match: `PostgreSQL pgvector stores embeddings for semantic search.` đứng đầu với distance `0.2727`.
- Query plan trên dataset 3 chunk dùng `rag_document_chunks_tenant_owner_idx` rồi sort bằng cosine distance, chưa chọn HNSW vì dataset quá nhỏ; đây là kết quả hợp lý để học cách đọc planner.
- Cập nhật `backend/docs/09_EMBEDDINGS_AND_PGVECTOR.md` với phần đọc query plan và lý do planner không nhất thiết dùng HNSW index.
- Kiểm chứng: `npm run typecheck` thành công; `npm test` có 76 test pass; `npm run smoke:pgvector` thành công; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành toàn bộ thực hành Tuần 5.
- Task tiếp theo: bắt đầu Tuần 6, thiết kế ingestion pipeline: parse, clean, chunk, embed và index.

### 2026-07-05 - RAG ingestion pipeline lab: parse, clean, chunk, embed và index

- Thêm module `backend/src/ingestion/` gồm parser, cleaner, recursive chunker, type contract và `IngestionPipeline`.
- `parseSourceDocument()` hỗ trợ plain text và PDF text-pages mô phỏng bằng delimiter `---page---`, giữ `pageNumber` để chuẩn bị citation.
- `cleanText()` chuẩn hóa CRLF, whitespace, dòng trống và trim text trước khi chunking.
- `chunkCleanedPages()` dùng recursive splitting theo paragraph/newline/câu/space, có `overlapCharacters`, `tokenEstimate`, metadata `page`, `parser` và `chunking`.
- `IngestionPipeline` parse, clean, chunk, tạo deterministic embedding và index document/chunk qua `VectorRepository`.
- Thêm `backend/src/scripts/ingestion-lab.ts` và script `npm run learn:ingestion`; lab ingest tài liệu PDF text-pages mô phỏng rồi query top-k, in page của match.
- Thêm `backend/tests/ingestion.test.ts` kiểm chứng parse giữ page number, clean whitespace, chunk overlap/metadata và pipeline index được chunk có page trace.
- Thêm tài liệu `backend/docs/10_RAG_INGESTION_PIPELINE.md` và cập nhật `backend/README.md`.
- Kiểm chứng: `npm run typecheck` thành công; `npm run learn:ingestion` thành công; `npm test` có 80 test pass; `npm run build` thành công sau khi chạy ngoài sandbox vì `backend/dist` cũ gây EPERM khi ghi đè.
- Hoàn thành task `Hiểu parse, OCR, clean, chunk, embed và index` ở mức lab có code/test; PDF parser nhị phân thật, upload validation, checksum và job recovery vẫn là các task thực hành tiếp theo.
- Task tiếp theo: so sánh fixed-size, recursive và structure-aware chunking; sau đó mở rộng ingestion sang upload và parse PDF thật có page number.

## Session Notes Template

Sao chép mẫu này vào Progress Log sau mỗi phiên:

```text
### YYYY-MM-DD

- Mục tiêu:
- Đã hoàn thành:
- File/code đã tạo:
- Kiến thức đã kiểm chứng:
- Test đã chạy:
- Vấn đề còn lại:
- Task tiếp theo:
```
