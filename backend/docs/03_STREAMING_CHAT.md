# Streaming Chat

## Why streaming matters

- Non-streaming waits for the full model response before the user sees anything.
- Streaming sends partial output as soon as the provider produces it.
- Streaming usually improves perceived latency more than total latency.
- The backend still needs to finish the provider request to collect usage metadata.

### Tiếng Việt

- Non-streaming chờ model trả lời xong toàn bộ rồi người dùng mới thấy kết quả.
- Streaming gửi từng phần output ngay khi provider sinh ra.
- Streaming thường cải thiện perceived latency nhiều hơn total latency.
- Backend vẫn cần chờ provider hoàn tất để lấy usage metadata.

## SSE, WebSocket, and streaming fetch

- SSE is simple for one-way server-to-client events, but browser `EventSource` only supports GET.
- WebSocket is useful for bidirectional low-latency sessions, but adds more connection state.
- Streaming `fetch` works well for POST JSON requests and readable response bodies.
- This project uses a POST streaming endpoint so React can send a JSON chat request and read chunks
  from the response body.

### Tiếng Việt

- SSE đơn giản cho event một chiều từ server về client, nhưng `EventSource` của browser chỉ hỗ trợ GET.
- WebSocket phù hợp với session hai chiều, latency thấp, nhưng làm tăng state cần quản lý.
- Streaming `fetch` phù hợp khi cần POST JSON request và đọc response body theo từng chunk.
- Dự án này dùng endpoint streaming dạng POST để React gửi JSON chat request và đọc từng chunk từ
  response body.

## Event contract

The backend streams text/event-stream blocks:

```text
event: delta
data: {\"type\":\"delta\",\"text\":\"hello\"}

```

Supported event types:

- `start`: provider and model metadata.
- `delta`: one partial text chunk.
- `usage`: token usage and latency when available.
- `end`: stream completed successfully.
- `error`: stream failed after the HTTP response had already started.

### Tiếng Việt

Backend stream các block `text/event-stream`:

```text
event: delta
data: {\"type\":\"delta\",\"text\":\"hello\"}

```

Các event được hỗ trợ:

- `start`: metadata về provider và model.
- `delta`: một phần text được sinh ra.
- `usage`: token usage và latency khi provider trả về.
- `end`: stream hoàn tất thành công.
- `error`: stream lỗi sau khi HTTP response đã bắt đầu.

## Chunking details

- Network chunks are not the same as model tokens.
- One network chunk can contain half an event, one full event, or multiple events.
- The client must buffer text until it sees the `\\n\\n` event boundary.
- Tests cover arbitrary chunk splits using `StreamEventParser`.

### Tiếng Việt

- Network chunk không đồng nhất với token của model.
- Một network chunk có thể chứa nửa event, một event đầy đủ hoặc nhiều event.
- Client cần buffer text cho đến khi gặp boundary `\\n\\n`.
- Test hiện đã kiểm tra trường hợp event bị cắt ở vị trí bất kỳ bằng `StreamEventParser`.

## Run a smoke test

```powershell
cd backend
npm run build
npm start
```

Then POST to:

```text
http://127.0.0.1:8000/api/chat/stream
```

with JSON:

```json
{\"message\":\"Reply with exactly three short words.\"}
```

### Tiếng Việt

Chạy smoke test bằng cách build và start backend, sau đó POST JSON tới
`/api/chat/stream`. Khi thành công, response sẽ có các event `start`, `delta`, `usage`, `end`.

