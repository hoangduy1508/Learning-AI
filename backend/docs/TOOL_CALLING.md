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

## Run

```bash
npm test
```

### Tiếng Việt

Chạy kiểm chứng:

```bash
npm test
```
