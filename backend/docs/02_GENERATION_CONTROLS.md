# Generation Controls

## Message roles

- The system instruction defines durable behavior, role, constraints, and response style.
- User input contains the current request or data.
- Model output is untrusted generated content and must be validated before sensitive use.
- System instructions guide a model but are not an authorization or security boundary.

### Tiếng Việt

- System instruction xác định hành vi, vai trò, ràng buộc và phong cách trả lời tương đối ổn định.
- User input chứa yêu cầu hoặc dữ liệu hiện tại của người dùng.
- Model output là dữ liệu được sinh tự động và không đáng tin cậy mặc định; cần validate trước khi
  dùng cho hành động nhạy cảm.
- System instruction chỉ hướng dẫn model, không phải ranh giới authorization hoặc security.

## Temperature

- Lower temperature narrows token sampling and is useful for extraction, classification, and
  reproducible-looking workflows.
- Higher temperature permits more variation and is useful for brainstorming or creative writing.
- Temperature does not guarantee determinism. Provider infrastructure and model changes may still
  produce different output.

### Tiếng Việt

- Temperature thấp thu hẹp phạm vi sampling, phù hợp với extraction, classification và workflow
  cần kết quả tương đối ổn định.
- Temperature cao cho phép nhiều biến thể hơn, phù hợp với brainstorming hoặc creative writing.
- Temperature không bảo đảm deterministic tuyệt đối. Hạ tầng provider hoặc phiên bản model thay
  đổi vẫn có thể tạo output khác nhau.

## Output limits

- `maxOutputTokens` is a hard generation budget, not a requested answer length.
- A low limit can truncate output and produce a `MAX_TOKENS` finish reason.
- Reserve enough context budget for both input and output.
- Thinking models may consume internal reasoning tokens. This lab disables thinking so the output
  limit is easier to observe.

### Tiếng Việt

- `maxOutputTokens` là ngân sách sinh token tối đa, không phải độ dài câu trả lời được yêu cầu.
- Giới hạn quá thấp có thể cắt ngang output và tạo finish reason `MAX_TOKENS`.
- Phải dành đủ context budget cho cả input lẫn output.
- Thinking model có thể dùng token cho reasoning nội bộ. Lab này tắt thinking để dễ quan sát tác
  động trực tiếp của output limit.

## Stop conditions

- A natural completion and a configured stop sequence commonly report `STOP`.
- A stop sequence is removed from the visible output and generation ends when it is produced.
- Stop sequences are useful for delimiters but should not be treated as a security control.

### Tiếng Việt

- Model hoàn thành tự nhiên hoặc gặp stop sequence thường trả finish reason `STOP`.
- Stop sequence không xuất hiện trong visible output; model dừng khi sinh đến marker đó.
- Stop sequence hữu ích để phân tách nội dung nhưng không được xem là một security control.

## Run the lab

```powershell
cd backend
npm run learn:generation
```

Inspect the output text, output token count, latency, and `finishReason` for each experiment.
The script spaces requests to respect the Gemini Free Tier request-per-minute limit and retries a
single `429` response after a delay.

### Tiếng Việt

Hãy quan sát output text, số output token, latency và `finishReason` của từng thí nghiệm. Script tự
giãn cách request để tuân thủ giới hạn request/phút của Gemini Free Tier và retry một lần sau khi
gặp lỗi `429`.
