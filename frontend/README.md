# AI Learning Frontend

Frontend React + TypeScript + Vite cho UI demo của Project 1 và Project 2.

## Cài đặt

```powershell
cd frontend
npm install
```

## Chạy local

Chạy backend trước:

```powershell
cd ..\backend
npm run dev
```

Chạy frontend ở terminal khác:

```powershell
cd ..\frontend
npm run dev
```

Mở:

```text
http://127.0.0.1:5173
```

## Các tab trong UI

### Chat

Demo Project 1 Streaming AI Chat:

- Nhập prompt và nhận output streaming.
- Dừng generation khi đang stream.
- Xem conversation id, provider, model, token usage, latency, estimated cost và cache hit.
- Xem cost summary cho `demo-user` nếu backend có persistence.

### Structured

Demo structured output:

- Nhập nội dung yêu cầu hỗ trợ.
- Backend yêu cầu model trả JSON.
- Kết quả được validate bằng schema trước khi render.

### Tools

Demo file agent và tool calling:

- Gửi prompt cho agent.
- Xem tool calls và tool results.
- Xem pending write/delete actions.
- Approve action khi backend yêu cầu.
- Xem tool audit log để debug hành vi agent.

### RAG

Demo Project 2 Secure RAG PDF Assistant:

- Upload file `.txt` hoặc `.pdf`.
- Xem document id, số trang, số chunk, version và batch embedding.
- Hỏi đáp trên tài liệu đã upload.
- Chọn retrieval strategy: `semantic`, `keyword`, `hybrid`.
- Điều chỉnh `topK` và similarity threshold.
- Xem answer, retrieved contexts, score và citations.
- Chạy evaluation nhanh với expected text và expected page.

Lưu ý: RAG demo hiện dùng vector repository in-memory phía backend. Nếu restart backend, cần upload lại tài liệu.

## Lệnh kiểm tra

```powershell
npm run typecheck
npm test
npm run build
```

## Backend API được UI dùng

- `POST /api/chat/stream`
- `GET /api/users/demo-user/cost-summary`
- `POST /api/structured/support-ticket`
- `POST /api/agent/chat`
- `GET /api/agent/pending`
- `POST /api/agent/approve`
- `GET /api/agent/audit`
- `POST /api/ingestion/upload`
- `POST /api/rag/query`
- `POST /api/rag/evaluate`
