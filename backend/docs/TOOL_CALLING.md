# Tool Calling Lab

This note captures the Week 3 fake weather tool lab.

### Tiếng Việt

Ghi chú này tóm tắt bài thực hành Tuần 3 về tool thời tiết giả lập.

## What Tool Calling Means

Tool calling means the model does not execute the action directly. The model proposes a tool name and arguments. The backend validates the arguments, checks permissions, executes the tool, and sends the result back to the model.

### Tiếng Việt

Tool calling nghĩa là model không trực tiếp thực thi hành động. Model chỉ đề xuất tên tool và arguments. Backend validate arguments, kiểm tra quyền, thực thi tool, rồi gửi kết quả về lại cho model.

## Fake Weather Tool

The `get_weather` tool is intentionally fake and deterministic. It does not call a real weather API, so tests do not need network access or secrets.

Tool input:

```json
{
  "location": "Ho Chi Minh City",
  "unit": "celsius"
}
```

Tool output:

```json
{
  "location": "Ho Chi Minh City",
  "unit": "celsius",
  "temperature": 27,
  "condition": "sunny",
  "humidityPercent": 65,
  "source": "fake-weather-tool"
}
```

### Tiếng Việt

Tool `get_weather` là tool giả lập có kết quả deterministic. Nó không gọi API thời tiết thật, nên test không cần network hoặc secret.

Input của tool:

```json
{
  "location": "Ho Chi Minh City",
  "unit": "celsius"
}
```

Output của tool:

```json
{
  "location": "Ho Chi Minh City",
  "unit": "celsius",
  "temperature": 27,
  "condition": "sunny",
  "humidityPercent": 65,
  "source": "fake-weather-tool"
}
```

## Validation Boundary

Gemini receives a function declaration for `get_weather`, but the backend still validates the actual arguments with Zod:

- `location` must be a non-empty string.
- `unit` must be `celsius` or `fahrenheit`.
- invalid model arguments are rejected and written to the audit log.

### Tiếng Việt

Gemini nhận function declaration cho `get_weather`, nhưng backend vẫn validate arguments thật bằng Zod:

- `location` phải là chuỗi không rỗng.
- `unit` chỉ được là `celsius` hoặc `fahrenheit`.
- arguments sai từ model bị từ chối và được ghi vào audit log.

## Read-Only vs Write Tools

`get_weather` is read-only: it returns data and does not mutate local state. Write tools such as `write_file` and `delete_file` need stricter controls: authorization, confirmation or explicit auto-apply configuration, idempotency, and audit logging.

### Tiếng Việt

`get_weather` là read-only tool: nó trả dữ liệu và không thay đổi local state. Write tool như `write_file` và `delete_file` cần kiểm soát chặt hơn: authorization, confirmation hoặc cấu hình auto-apply rõ ràng, idempotency và audit logging.

## Order Status Tool

The `get_order_status` tool reads from a fake order store. The model only proposes `orderId`; the backend uses the current authenticated user context to check ownership before returning the order.

Valid input:

```json
{
  "orderId": "ord_1001"
}
```

Important security rule:

- Do not trust a `userId` from model arguments.
- Ownership is checked with backend context, currently `currentUserId`.
- Orders owned by another user return an authorization error.
- Malformed `orderId` values are rejected by Zod before lookup.

### Tiếng Việt

Tool `get_order_status` đọc từ fake order store. Model chỉ đề xuất `orderId`; backend dùng context user hiện tại đã xác thực để kiểm tra ownership trước khi trả dữ liệu đơn hàng.

Input hợp lệ:

```json
{
  "orderId": "ord_1001"
}
```

Quy tắc bảo mật quan trọng:

- Không tin `userId` do model gửi trong arguments.
- Ownership được kiểm tra bằng context backend, hiện là `currentUserId`.
- Đơn hàng thuộc user khác sẽ trả lỗi authorization.
- `orderId` sai format bị Zod từ chối trước khi lookup.

## Support Ticket Tool

The `create_support_ticket` tool is a write action. The model can propose a ticket, but the backend does not create it immediately. The backend validates the proposal, creates a pending action, and waits for approval.

Valid proposal:

```json
{
  "title": "Invoice download fails",
  "category": "billing",
  "priority": "high",
  "customerEmail": "linh@example.com",
  "summary": "The customer cannot download the latest invoice from the billing page.",
  "idempotencyKey": "ticket_invoice_download_fails"
}
```

Execution rules:

- The proposal is validated with Zod before entering the pending queue.
- The backend adds `confirmation: "CREATE_TICKET"` only after approval.
- `idempotencyKey` prevents duplicate tickets when a request is retried.
- Audit log redacts email and ticket summary content.

### Tiếng Việt

Tool `create_support_ticket` là write action. Model có thể đề xuất ticket, nhưng backend không tạo ngay. Backend validate proposal, tạo pending action và chờ approval.

Proposal hợp lệ:

```json
{
  "title": "Invoice download fails",
  "category": "billing",
  "priority": "high",
  "customerEmail": "linh@example.com",
  "summary": "The customer cannot download the latest invoice from the billing page.",
  "idempotencyKey": "ticket_invoice_download_fails"
}
```

Quy tắc thực thi:

- Proposal được validate bằng Zod trước khi vào hàng chờ pending.
- Backend chỉ thêm `confirmation: "CREATE_TICKET"` sau khi user approve.
- `idempotencyKey` ngăn tạo trùng ticket khi request bị retry.
- Audit log redact email và nội dung summary của ticket.

## Run

```bash
npm test
```

### Tiếng Việt

Chạy kiểm chứng:

```bash
npm test
```
