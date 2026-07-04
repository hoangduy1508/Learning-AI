# Structured Output and JSON Schema

This note captures the Week 3 structured-output lab.

### Tiếng Việt

Ghi chú này tóm tắt bài thực hành Tuần 3 về structured output.

## Concepts

### Tiếng Việt

Các khái niệm chính cần phân biệt.

### JSON Schema

JSON Schema is a language-neutral contract for JSON data. It describes object shape, required fields, primitive types, enums, arrays, nested objects, and validation rules. In a TypeScript backend, Zod can play the same role at runtime: never trust a model response until it passes a schema.

### Tiếng Việt

JSON Schema là một contract không phụ thuộc ngôn ngữ cho dữ liệu JSON. Nó mô tả shape của object, field bắt buộc, primitive type, enum, array, nested object và rule validation. Trong backend TypeScript, Zod có thể đóng vai trò tương tự ở runtime: không tin output của model cho đến khi dữ liệu pass schema.

Example support ticket shape:

### Tiếng Việt

Ví dụ shape của support ticket:

```json
{
  "title": "Cannot access invoice",
  "category": "billing",
  "priority": "high",
  "customerEmail": "linh@example.com",
  "summary": "The customer cannot access the latest invoice.",
  "needsHumanReview": true
}
```

### JSON Mode

JSON mode asks the provider to return syntactically valid JSON. It reduces parsing failures, but it does not prove that the JSON matches the application's domain contract.

### Tiếng Việt

JSON mode yêu cầu provider trả về JSON hợp lệ về mặt cú pháp. Nó giảm lỗi parse, nhưng không chứng minh JSON đó khớp với domain contract của ứng dụng.

Valid JSON can still be unusable:

### Tiếng Việt

JSON hợp lệ vẫn có thể không dùng được:

```json
{
  "category": "refund",
  "priority": "urgent",
  "needsHumanReview": "yes"
}
```

This is valid JSON, but invalid for the support ticket schema.

### Tiếng Việt

Đây là JSON hợp lệ về cú pháp, nhưng sai schema của support ticket.

### Schema-Constrained Output

Schema-constrained output gives the provider a schema and asks it to generate only values that match that schema. This is stronger than plain JSON mode, but the backend still validates the response because providers, SDKs, prompt changes, and model behavior can fail.

### Tiếng Việt

Schema-constrained output đưa schema cho provider và yêu cầu model chỉ sinh dữ liệu khớp schema đó. Cách này mạnh hơn JSON mode thuần, nhưng backend vẫn phải validate lại vì provider, SDK, prompt hoặc hành vi model đều có thể lỗi.

### Structured Output

Structured output is the application pattern: ask the model for machine-readable data, parse it, validate it, and only then use it in code. The backend should treat the model output as untrusted input.

### Tiếng Việt

Structured output là pattern ở tầng ứng dụng: yêu cầu model trả dữ liệu machine-readable, parse dữ liệu đó, validate, rồi mới dùng trong code. Backend phải xem output của model là untrusted input.

In this repository:

- `parseJsonObject()` parses the model text.
- `supportTicketSchema` validates the parsed object with Zod.
- `parseSupportTicket()` rejects malformed JSON and schema mismatches.
- `POST /api/structured/support-ticket` exposes a small extraction endpoint.

### Tiếng Việt

Trong repository này:

- `parseJsonObject()` parse text từ model.
- `supportTicketSchema` validate object đã parse bằng Zod.
- `parseSupportTicket()` từ chối malformed JSON và schema mismatch.
- `POST /api/structured/support-ticket` expose một endpoint extraction nhỏ.

### Tool Calling

Tool calling is different from structured output. The model chooses a named tool and proposes arguments. The backend owns execution.

### Tiếng Việt

Tool calling khác structured output. Model chọn một tool có tên cụ thể và đề xuất arguments. Backend mới là nơi sở hữu quyền thực thi.

Important boundary:

- Structured output returns data for the application to read.
- Tool calling proposes an action for the application to execute or reject.
- Write tools need authorization, confirmation, idempotency, and audit logging.

### Tiếng Việt

Ranh giới quan trọng:

- Structured output trả dữ liệu để ứng dụng đọc.
- Tool calling đề xuất một hành động để ứng dụng thực thi hoặc từ chối.
- Write tool cần authorization, confirmation, idempotency và audit logging.

## Lab Result

Implemented a support-ticket extraction flow:

1. Build a prompt that asks for one JSON object.
2. Parse the model text into JSON.
3. Validate the object with Zod.
4. Return typed data only after validation succeeds.
5. Reject malformed JSON and domain-invalid JSON with `422`.

### Tiếng Việt

Đã triển khai flow extract support ticket:

1. Build prompt yêu cầu model trả đúng một JSON object.
2. Parse text từ model thành JSON.
3. Validate object bằng Zod.
4. Chỉ trả typed data sau khi validation thành công.
5. Từ chối malformed JSON và JSON sai domain bằng `422`.

Tests cover:

- Fenced JSON parsing.
- API extraction success.
- Malformed JSON rejection.
- Schema mismatch rejection.

### Tiếng Việt

Test đã cover:

- Parse JSON bị bọc trong markdown fence.
- API extraction thành công.
- Từ chối malformed JSON.
- Từ chối schema mismatch.

Run:

### Tiếng Việt

Chạy kiểm chứng:

```bash
npm test
```
