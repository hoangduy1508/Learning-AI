# Tokens, Tokenization, and Context Window

## Core concepts

- A token is the unit an LLM processes. It is not the same as a word or character.
- Tokenization splits text into vocabulary units. Language, punctuation, code, and formatting
  change the token count.
- `countTokens` estimates input tokens before generation.
- Usage metadata reports tokens actually processed after generation.
- A context window is the model's maximum token budget for input and generated output.
- A model may also consume internal thinking tokens. Therefore, total usage can be larger than
  visible input plus visible output.

### Tiếng Việt

- Token là đơn vị mà LLM xử lý, không đồng nhất với một từ hoặc một ký tự.
- Tokenization là quá trình tách nội dung thành các đơn vị thuộc vocabulary. Ngôn ngữ, dấu câu,
  code và cách định dạng đều có thể làm thay đổi số token.
- `countTokens` ước tính số input token trước khi model sinh câu trả lời.
- Usage metadata cho biết số token thực tế đã được xử lý sau khi model trả lời.
- Context window là tổng ngân sách token tối đa model có thể xử lý cho input và output.
- Model có thể sử dụng thinking token nội bộ. Vì vậy total usage có thể lớn hơn tổng input và
  output mà người dùng nhìn thấy.

## Gemini usage fields

- `promptTokenCount`: input tokens sent to the model, including instructions.
- `candidatesTokenCount`: visible generated output tokens.
- `thoughtsTokenCount`: internal reasoning tokens for a thinking model.
- `totalTokenCount`: the complete usage reported by the provider.

`countTokens` and `promptTokenCount` can differ when the generated request includes additional
content such as a system instruction.

### Tiếng Việt

- `promptTokenCount`: số input token gửi tới model, bao gồm cả instruction.
- `candidatesTokenCount`: số token trong output hiển thị cho người dùng.
- `thoughtsTokenCount`: số token reasoning nội bộ của thinking model.
- `totalTokenCount`: tổng usage do provider báo cáo.

`countTokens` và `promptTokenCount` có thể khác nhau khi request generate chứa thêm nội dung như
system instruction. Trong token lab, phần chênh lệch quan sát được chính là instruction được thêm
khi gọi model.

## Run the lab

```powershell
cd backend
npm run learn:tokens
```

The script compares character count, word count, preflight token count, billed input tokens,
output tokens, thinking tokens, total tokens, and latency.

### Tiếng Việt

Script so sánh số ký tự, số từ, token được đếm trước request, input token thực tế, output token,
thinking token, total token và latency. Lệnh này gọi Gemini thật nên sẽ sử dụng quota API.

## Production implications

- Count or estimate tokens before sending large documents or conversation histories.
- Reserve room in the context window for the model's output.
- Limit output tokens explicitly for predictable latency and cost.
- Do not estimate cost from word count alone.
- Track provider-specific usage fields instead of assuming all providers report usage equally.

### Tiếng Việt

- Đếm hoặc ước tính token trước khi gửi tài liệu lớn hay conversation history dài.
- Luôn chừa một phần context window cho output của model.
- Đặt giới hạn output token để latency và chi phí dễ dự đoán hơn.
- Không ước tính chi phí chỉ dựa vào số từ.
- Theo dõi usage theo từng provider vì mỗi provider có thể báo cáo token khác nhau.

Official reference: <https://ai.google.dev/gemini-api/docs/tokens>

Note: the project currently uses `gemini-2.5-flash` for labs because it is reliable for low-latency
learning tasks and streaming. You can switch back to a newer model in `.env` when quota and model
availability are stable.

### Tiếng Việt

Ghi chú: dự án hiện dùng `gemini-2.5-flash` cho các lab vì model này ổn định cho bài học
low-latency và streaming. Có thể đổi lại model mới hơn trong `.env` khi quota và trạng thái model
ổn định.
