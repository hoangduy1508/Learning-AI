# Retrieval Và RAG Evaluation

## Mục Tiêu

Tuần 7 chuyển từ “đã index được chunk” sang “lấy đúng bằng chứng và biết đo chất lượng”.

Pipeline nằm ở `backend/src/rag/retrieval.ts`:

```text
question
  -> semantic search / keyword search / hybrid search
  -> threshold
  -> retrieved contexts
  -> grounded answer with citations
  -> evaluation metrics
```

## Top-K Và Similarity Threshold

`topK` là số lượng context tối đa được lấy về. Top-k cao giúp tăng khả năng có bằng chứng đúng, nhưng làm prompt
dài hơn và dễ đưa nhiễu vào generation.

`similarityThreshold` là ngưỡng điểm tối thiểu. Nếu không có context nào vượt ngưỡng, pipeline trả:

```text
Không đủ bằng chứng trong tài liệu đã truy xuất để trả lời câu hỏi này.
```

Đây là guard quan trọng của RAG: không phải câu hỏi nào cũng nên trả lời. Khi retrieved context yếu, refusal tốt
hơn hallucination.

## Semantic, Keyword Và Hybrid Search

Semantic search dùng embedding của query và chunk, phù hợp khi người dùng diễn đạt khác với tài liệu nhưng cùng ý.

Keyword/BM25 phù hợp với tên riêng, mã đơn hàng, thuật ngữ chính xác, số trang, acronym hoặc chuỗi định danh.
Trong lab, in-memory repository dùng BM25-lite; PostgreSQL path dùng `to_tsvector`, `websearch_to_tsquery` và
`ts_rank`.

Hybrid search trộn hai nguồn:

- Semantic score giúp bắt nghĩa.
- Keyword score giúp giữ tín hiệu chính xác.
- Kết quả được merge theo `chunkId`, sort theo score và cắt top-k.

Trade-off: hybrid thường ổn định hơn từng strategy riêng lẻ, nhưng cần tune trọng số và normalization.

## Query Rewriting Và Multi-Query Retrieval

Query rewriting biến câu hỏi người dùng thành câu search rõ hơn, ví dụ bỏ lời xã giao hoặc thêm thuật ngữ miền.
Multi-query retrieval tạo nhiều biến thể câu hỏi, retrieve từng biến thể rồi merge/deduplicate candidate.

Trong repo hiện tại, phần này được kiểm chứng ở mức kiến thức và thiết kế trong doc; code lab chưa gọi LLM rewrite
thật để tránh phụ thuộc provider. Khi production hóa, rewrite output phải được validate và giới hạn số query để
tránh tăng cost quá mạnh.

## Reranking

Reranking là bước lấy candidate từ retriever nhanh rồi dùng model mạnh hơn để sắp xếp lại. Retriever trả về nhiều
ứng viên thô, reranker đánh giá mức liên quan sâu hơn giữa query và từng passage.

Không nên dùng reranker thay cho authorization filter. Filter tenant/user phải chạy trước hoặc trong retrieval.

## Citation Và Refusal

`answerWithCitations()` chỉ tạo citation từ context thật đã retrieve:

- `chunkId`
- `documentId`
- `pageNumber`
- `sourceUri`

Điểm cần nhớ: model không được tự tạo nguồn. Nếu nguồn không nằm trong retrieved context, không đưa vào citation.

## Evaluation

`backend/src/rag/evaluation.ts` đo ba nhóm metric:

- `retrievalRecall`: retrieved context có chứa document/page đúng không.
- `answerCorrectness`: câu trả lời có chứa ý mong đợi không.
- `citationCorrectness`: citation có trỏ về đúng document/page không.

Lab `npm run learn:rag-evaluation` tạo 30 câu hỏi có đáp án chuẩn và so sánh `semantic`, `keyword`, `hybrid`.
Evaluation report quan trọng hơn demo thủ công vì nó cho biết thay đổi chunking/retrieval có thật sự cải thiện
hay chỉ nhìn có vẻ tốt.

## Phân Biệt Retrieval Quality Và Generation Quality

Retrieval quality trả lời câu hỏi: “Hệ thống có lấy đúng bằng chứng không?”

Generation quality trả lời câu hỏi: “Model có dùng bằng chứng đúng cách để trả lời không?”

Nếu retrieval sai, model giỏi cũng dễ trả lời sai. Nếu retrieval đúng nhưng answer sai, cần kiểm prompt,
instruction, context formatting hoặc model.

## Chạy Lab

```powershell
cd backend
npm run learn:rag-evaluation
```

Lab in evaluation report cho từng strategy và một câu trả lời mẫu có citation.
