# Filesystem Tools

## What this feature does

The backend can expose local filesystem operations as controlled tools:

- list allowed roots
- list directory entries
- read a file
- search text inside files
- write a file
- delete a file

The LLM provider cannot access your disk by itself. Your backend must perform the filesystem action
after validating the request.

### Tiếng Việt

Backend có thể cung cấp các thao tác filesystem dưới dạng tool có kiểm soát:

- liệt kê các root được phép
- liệt kê file/thư mục
- đọc file
- tìm text trong file
- ghi file
- xóa file

LLM provider không tự truy cập được ổ đĩa của bạn. Backend của bạn mới là nơi thực sự chạy thao tác
filesystem sau khi validate request.

## Configuration

Configure allowed roots in `backend/.env`:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\3sdesign
FILE_TOOL_ALLOW_WRITE=true
FILE_TOOL_ALLOW_DELETE=true
FILE_TOOL_MAX_FILE_BYTES=1000000
```

Multiple roots can be separated with semicolons:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\3sdesign;E:\Project\AnotherRepo
```

### Tiếng Việt

Cấu hình thư mục được phép trong `backend/.env`:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\3sdesign
FILE_TOOL_ALLOW_WRITE=true
FILE_TOOL_ALLOW_DELETE=true
FILE_TOOL_MAX_FILE_BYTES=1000000
```

Nếu có nhiều root, phân tách bằng dấu chấm phẩy:

```dotenv
FILE_TOOL_ALLOWED_ROOTS=E:\Project\3sdesign;E:\Project\AnotherRepo
```

## Safety rules

- Every path is resolved and checked against `FILE_TOOL_ALLOWED_ROOTS`.
- Path traversal such as `..\outside.txt` is blocked.
- Write requires `FILE_TOOL_ALLOW_WRITE=true`.
- Delete requires `FILE_TOOL_ALLOW_DELETE=true`.
- Delete also requires request body field `confirmation: "DELETE"`.
- Deleting an allowed root itself is blocked.
- Large files are rejected based on `FILE_TOOL_MAX_FILE_BYTES`.

### Tiếng Việt

- Mọi path đều được resolve và kiểm tra phải nằm trong `FILE_TOOL_ALLOWED_ROOTS`.
- Path traversal như `..\outside.txt` bị chặn.
- Ghi file cần `FILE_TOOL_ALLOW_WRITE=true`.
- Xóa file cần `FILE_TOOL_ALLOW_DELETE=true`.
- Xóa file còn cần body có `confirmation: "DELETE"`.
- Không cho xóa chính allowed root.
- File quá lớn bị từ chối theo `FILE_TOOL_MAX_FILE_BYTES`.

## API examples

List roots:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/files/roots
```

List files:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/files/list `
  -ContentType "application/json" `
  -Body '{"path":"."}'
```

Read a file:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/files/read `
  -ContentType "application/json" `
  -Body '{"path":"package.json"}'
```

Search text:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/files/search `
  -ContentType "application/json" `
  -Body '{"query":"Login","limit":20}'
```

Write a file:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/files/write `
  -ContentType "application/json" `
  -Body '{"path":"notes/ai-test.txt","content":"hello from file tool","createDirs":true}'
```

Delete a file:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/files/delete `
  -ContentType "application/json" `
  -Body '{"path":"notes/ai-test.txt","confirmation":"DELETE"}'
```

### Tiếng Việt

Các API trên là lớp tool nền. Bước tiếp theo mới là nối chúng vào LLM tool calling để model đề xuất
gọi `list/read/search/write/delete`, còn backend vẫn là nơi kiểm tra quyền và thực thi.

## Next step: connect to an agent

This feature is intentionally deterministic for now. To make an AI agent use it, the next layer
should expose these operations as LLM tools, then require confirmation before write/delete actions.

### Tiếng Việt

Tính năng hiện tại được thiết kế deterministic trước. Để AI agent dùng được, lớp tiếp theo sẽ expose
các thao tác này thành LLM tools, sau đó yêu cầu confirmation trước hành động write/delete.
