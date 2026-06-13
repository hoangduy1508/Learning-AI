# AI Integration Learning Plan

> File context dài hạn cho lộ trình học AI Integration dành cho Senior Fullstack Developer có nền tảng Angular + FastAPI.

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
- Nền tảng chính: Angular, FastAPI, Python, TypeScript
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
6. Framework như LangGraph, LangChain, CrewAI

Nguyên tắc: học API và kiến trúc nguyên bản trước, framework sau.

## Technology Stack

### Frontend

- Angular
- TypeScript
- Streaming qua `fetch`, SSE hoặc RxJS
- Markdown rendering và syntax highlighting

### Backend

- Python
- FastAPI
- Pydantic
- SQLAlchemy
- Alembic

### AI

- OpenAI Responses API làm provider đầu tiên
- Google Gemini API và Anthropic API để học provider abstraction
- LangGraph cho workflow/agent có state
- MCP Python SDK

### Data và Infrastructure

- PostgreSQL
- pgvector
- Redis khi cần caching/rate limiting
- Docker Compose
- pytest

## Kế hoạch 12 tuần

### Tuần 1: Nền tảng LLM API

Kiến thức:

- [ ] Hiểu token, tokenizer và context window
- [ ] Hiểu system instruction, user input và model output
- [ ] Hiểu temperature, output limit và stop condition
- [ ] Quản lý API key bằng environment variable
- [ ] Đọc token usage, latency và ước tính cost
- [ ] Phân biệt model, API và provider

Thực hành:

- [ ] Tạo FastAPI project có cấu trúc rõ ràng
- [ ] Tạo endpoint `POST /api/chat`
- [ ] Gọi OpenAI từ backend
- [ ] Không để API key hoặc provider credential trong Angular
- [ ] Ghi log model, latency, input token và output token
- [ ] Viết unit test cho service gọi LLM bằng mock

Definition of Done:

- API trả lời được câu hỏi.
- Secret không xuất hiện trong source code hoặc frontend bundle.
- Có xử lý timeout và lỗi provider cơ bản.

### Tuần 2: Streaming Chat

Kiến thức:

- [ ] Hiểu HTTP streaming
- [ ] So sánh SSE, WebSocket và streaming `fetch`
- [ ] Hiểu event/chunk/delta
- [ ] Hiểu perceived latency và total latency
- [ ] Hiểu cancel, timeout, retry và mất kết nối

Thực hành:

- [ ] Stream output từ provider qua FastAPI
- [ ] Angular hiển thị từng phần của câu trả lời
- [ ] Thêm nút Stop generating
- [ ] Abort request khi component bị destroy
- [ ] Xử lý loading, partial output và error state
- [ ] Test parser với chunk bị chia ở vị trí bất kỳ

Definition of Done:

- Người dùng thấy token/chunk xuất hiện dần.
- Hủy request giải phóng tài nguyên backend.
- Lỗi giữa stream được hiển thị đúng trên UI.

### Tuần 3: Structured Output và Tool Calling

Kiến thức:

- [ ] Hiểu JSON Schema
- [ ] Phân biệt JSON mode và schema-constrained output
- [ ] Phân biệt structured output và tool calling
- [ ] Hiểu tool choice, tool arguments và tool result
- [ ] Không tin tưởng dữ liệu do model tạo ra

Thực hành:

- [ ] Parse structured output bằng Pydantic
- [ ] Tạo tool thời tiết giả lập
- [ ] Tạo tool đọc trạng thái đơn hàng
- [ ] Tạo tool tạo support ticket
- [ ] Validate authorization trước khi gọi tool
- [ ] Yêu cầu confirmation trước write action
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

### Tuần 9: LangGraph

Kiến thức:

- [ ] Hiểu state graph, node, edge và conditional edge
- [ ] Hiểu checkpoint và persistence
- [ ] Hiểu interrupt/human approval
- [ ] Hiểu retry và error recovery theo node
- [ ] Hiểu observability cho workflow nhiều bước

Thực hành:

- [ ] Chuyển agent loop sang LangGraph
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

- [ ] Viết MCP server bằng Python
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

- Angular chat UI
- FastAPI backend
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

- Angular + FastAPI
- RAG có citation
- LangGraph workflow
- MCP tools/resources
- Human approval cho write action
- Role-based access control
- Audit log
- Provider abstraction
- Tracing, cost dashboard và evaluation
- Docker Compose và tài liệu kiến trúc

## Kiến trúc Capstone dự kiến

```text
Angular
   |
FastAPI API Gateway
   |-- Authentication / Authorization
   |-- Rate Limiting
   |-- Conversation Service
   |-- LangGraph Workflow
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
- LangGraph: <https://docs.langchain.com/oss/python/langgraph/overview>
- OWASP GenAI Security: <https://genai.owasp.org/>

## Current Progress

- Current phase: Chưa bắt đầu
- Current week: Tuần 1
- Current task: Khởi tạo FastAPI project và gọi LLM API lần đầu
- Blockers: Chưa có
- Last updated: 2026-06-13

## Progress Log

### 2026-06-13

- Tạo lộ trình học 12 tuần.
- Chọn Angular + FastAPI + PostgreSQL/pgvector làm stack chính.
- Xác định ba dự án portfolio: Streaming Chat, Secure RAG PDF Assistant và Enterprise AI Assistant.

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
