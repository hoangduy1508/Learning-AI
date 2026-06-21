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

- [ ] Hiểu JSON Schema
- [ ] Phân biệt JSON mode và schema-constrained output
- [ ] Phân biệt structured output và tool calling
- [x] Hiểu tool choice, tool arguments và tool result
- [~] Không tin tưởng dữ liệu do model tạo ra

Thực hành:

- [ ] Parse structured output bằng Zod
- [ ] Tạo tool thời tiết giả lập
- [ ] Tạo tool đọc trạng thái đơn hàng
- [ ] Tạo tool tạo support ticket
- [ ] Validate authorization trước khi gọi tool
- [x] Yêu cầu confirmation trước write action
- [ ] Test malformed arguments và unauthorized call

Definition of Done:

- Model không trực tiếp chạy SQL.
- Mọi tool input đều được validate.
- Write action có idempotency hoặc confirmation.

### Tuần 4: Conversation và Production Basics

Kiến thức:

- [ ] Thiết kế bảng conversation và message
- [ ] Hiểu sliding window, truncation, summarization và compaction
- [ ] Hiểu retry với exponential backoff và jitter
- [ ] Hiểu rate limiting
- [ ] Hiểu model routing, fallback và caching

Thực hành:

- [ ] Lưu conversation trong PostgreSQL
- [ ] Chỉ gửi history cần thiết cho model
- [ ] Thêm giới hạn message/context
- [ ] Thêm rate limit theo user
- [ ] Theo dõi cost theo request và user
- [ ] Hoàn thiện Project 1

Definition of Done:

- Conversation tiếp tục được sau khi reload trang.
- History dài không làm request vượt context window.
- Có test cho retry, rate limit và conversation ownership.

### Tuần 5: Embedding và Vector Search

Kiến thức:

- [ ] Hiểu embedding và vector dimension
- [ ] Hiểu cosine similarity, cosine distance, dot product và L2
- [ ] Hiểu exact và approximate nearest-neighbor search
- [ ] Hiểu HNSW và IVFFlat ở mức sử dụng
- [ ] Hiểu metadata filtering

Thực hành:

- [ ] Chạy PostgreSQL + pgvector bằng Docker
- [ ] Tạo bảng document và document chunk
- [ ] Lưu embedding kèm metadata
- [ ] Truy vấn top-k bằng cosine distance
- [ ] So sánh kết quả với các query khác nhau
- [ ] Thử HNSW index và xem query plan

Definition of Done:

- Giải thích được vì sao kết quả gần nhất không nhất thiết đúng nhất.
- Query luôn lọc theo tenant/user trước khi trả context.

### Tuần 6: RAG Ingestion Pipeline

Kiến thức:

- [ ] Hiểu parse, OCR, clean, chunk, embed và index
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

- Current phase: Structured Output và Tool Calling
- Current week: Tuần 3
- Current task: Manual QA File Agent auto-apply với thư mục học tập an toàn, sau đó thêm audit log cho tool call
- Blockers: In-app Browser không khởi động được trong sandbox hiện tại; `/api/agent/chat` với Gemini có thể gửi metadata/nội dung file tới provider bên ngoài; auto-apply write/delete đã được bật theo yêu cầu người dùng nên chỉ dùng với thư mục được allowlist và dữ liệu học tập
- Last updated: 2026-06-18

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

- Thêm script tái sử dụng `npm run learn:tokens` và tài liệu `backend/docs/TOKENS_AND_CONTEXT.md`.
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

- Thêm `npm run learn:generation` và tài liệu `backend/docs/GENERATION_CONTROLS.md`.
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
- Thêm tài liệu song ngữ `backend/docs/STREAMING_CHAT.md`.
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
- Thêm tài liệu song ngữ `backend/docs/FILESYSTEM_TOOLS.md`.
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
