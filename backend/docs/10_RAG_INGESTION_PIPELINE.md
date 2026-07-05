# RAG Ingestion Pipeline

## Mục tiêu

Tuần 6 bắt đầu bằng pipeline đưa tài liệu vào vector index:

- Parse tài liệu thành text có số trang.
- Clean text để giảm nhiễu trước khi chunk.
- Chunk text thành các passage có kích thước ổn định.
- Embed từng chunk.
- Index chunk kèm metadata để retrieval có thể trace về document/page.

## Flow

Pipeline hiện nằm tại `backend/src/ingestion/pipeline.ts`:

```text
SourceDocument
  -> parseSourceDocument()
  -> cleanParsedDocument()
  -> chunkCleanedPages()
  -> createDeterministicEmbedding()
  -> VectorRepository.createDocument()/insertChunk()
```

Trong lab này, `application/pdf` có hai đường đi:

- PDF text-pages mô phỏng bằng plain text có delimiter `---page---`, dùng cho test nhanh.
- PDF thật dạng base64 với `contentEncoding: "base64"`, parse bằng `pdfjs-dist` và giữ page number.

Điều quan trọng cần học ở bước này là contract của ingestion: parser phải trả về page number,
chunk phải giữ metadata page, và index phải lưu metadata đó cùng embedding.

Scanned PDF/OCR vẫn là một nhánh riêng: nếu parser không lấy được text, ingestion job cần đánh dấu lỗi rõ ràng
thay vì tạo chunk rỗng.

## Parse

`parseSourceDocument()` trả về `ParsedDocument` gồm:

- `parser`: loại parser đã dùng.
- `pages`: mảng `{ pageNumber, text }`.
- `title` và `sourceUri`.

Plain text mặc định là một page. PDF text-pages tách theo `---page---` để lab có thể kiểm chứng page trace
nhanh. PDF thật được parse bằng `parseSourceDocumentAsync()` và trả `parser: "pdfjs"`.

## Clean

`cleanText()` xử lý các lỗi thường gặp sau parse:

- Chuẩn hóa CRLF về LF.
- Bỏ trailing spaces trước newline.
- Gộp nhiều dòng trống thành tối đa hai newline.
- Gộp nhiều space/tab thành một space.
- Trim đầu/cuối document.

`cleanParsedDocument()` có tùy chọn `repeatedLineMinPages` để loại các dòng lặp lại trên nhiều trang,
ví dụ header/footer PDF như tên công ty, nhãn bảo mật hoặc tiêu đề bảng lặp.

Cleaning nên được làm trước chunking vì whitespace và header/footer lặp làm chunk bị cắt vô nghĩa,
tăng token và khiến retrieval trả về context nghèo thông tin.

## Artifact Analysis

`analyzeDocumentArtifacts()` trong `backend/src/ingestion/artifacts.ts` tạo báo cáo nhanh về các vấn đề
thường gặp sau khi parse:

- `tableLikeLineCount`: số dòng giống bảng, ví dụ có nhiều cột phân tách bằng `|` hoặc nhiều khoảng trắng.
- `repeatedLines`: dòng xuất hiện trên nhiều page, thường là header/footer hoặc tiêu đề bảng lặp.
- `hasExtractableText`: parser có lấy được text thật hay không.
- `scannedPdfLikely`: PDF có vẻ là scanned PDF khi không có text extractable.

Tác động cần nhớ:

- Bảng dễ bị parse mất cấu trúc cột/hàng. Nếu table quan trọng, nên giữ row boundary hoặc chuyển table thành
  dạng Markdown/CSV-like trước khi chunk.
- Header/footer lặp lại có thể chiếm top-k vì xuất hiện ở nhiều page nhưng không trả lời câu hỏi thật.
- Scanned PDF không có text extractable cần OCR; không nên embed chuỗi rỗng hoặc thông báo lỗi mơ hồ.

## Chunk

Pipeline mặc định vẫn dùng `chunkCleanedPages()` với recursive text splitting:

1. Ưu tiên cắt theo paragraph.
2. Nếu không được, cắt theo newline.
3. Sau đó cắt theo câu.
4. Cuối cùng mới cắt theo space hoặc hard limit.

Chunk có `overlapCharacters` để chunk sau mang một phần ngữ cảnh từ chunk trước. Overlap giúp retrieval
không mất thông tin nằm ngay biên chunk, nhưng overlap quá lớn sẽ tăng số chunk, token, chi phí embedding
và nguy cơ duplicate context.

Mỗi chunk lưu metadata:

- `page`: page number để citation.
- `parser`: parser đã tạo text.
- `chunking`: strategy đã dùng.
- `sectionTitle`: section heading nếu strategy có thể nhận diện.
- `tokenEstimate`: ước tính token đơn giản để quan sát kích thước chunk.

## So Sánh Chunking Strategies

Module `backend/src/ingestion/chunking.ts` có ba strategy để so sánh:

- `fixed-size`: cắt theo số ký tự cố định. Đơn giản, deterministic, dễ batch, nhưng có thể cắt ngang câu,
  bảng hoặc heading.
- `recursive-text`: ưu tiên paragraph/newline/câu/space trước khi hard cut. Đây là default tốt cho text
  chung vì giữ boundary tự nhiên hơn fixed-size.
- `structure-aware`: nhận diện heading Markdown và chunk theo section trước, sau đó mới recursive split trong
  section. Cách này hữu ích với tài liệu có heading rõ ràng vì chunk có thêm `sectionTitle`, nhưng kém tác dụng
  nếu PDF parse ra text mất cấu trúc.

Trade-off quan trọng:

- Chunk quá nhỏ: retrieval có thể lấy đúng keyword nhưng thiếu ngữ cảnh để answer.
- Chunk quá lớn: ít mất context hơn nhưng tăng token, giảm độ chính xác của top-k và làm prompt nặng hơn.
- Overlap giúp giữ ngữ cảnh ở biên chunk, nhưng overlap cao làm tăng số chunk và chi phí embedding.
- Structure-aware tốt khi parser giữ được heading/list/table; nếu parser làm mất cấu trúc thì phải fallback
  về recursive/fixed-size.

## Overlap Và Parent-Child Chunking

Overlap copy một phần cuối của chunk trước sang chunk sau. Lợi ích là query vẫn có thể match khi ý quan trọng
nằm ngay biên chunk. Cái giá phải trả là:

- Nhiều chunk hơn.
- Nhiều embedding hơn.
- Retrieved context dễ bị lặp lại nội dung.

Parent-child chunking giải quyết một trade-off khác:

- Parent chunk lớn hơn, thường là page hoặc section, để giữ ngữ cảnh đọc hiểu.
- Child chunk nhỏ hơn, có overlap, được embed và dùng để vector search.
- Khi child chunk match query, metadata `parentChunkIndex` và `parentSectionTitle` cho phép hệ thống lấy parent
  context rộng hơn để tạo câu trả lời.

Trong lab, `createParentChildChunks()` tạo parent bằng structure-aware chunking, sau đó cắt parent thành child
chunk nhỏ hơn. Child chunk lưu metadata:

- `parentChunkIndex`: parent trong cùng document/page.
- `parentSectionTitle`: heading của section nếu có.
- `childOverlapCharacters`: overlap đã dùng khi cắt child.

Production thường không nên đưa toàn bộ parent vào mỗi metadata row nếu parent quá lớn. Tốt hơn là lưu parent
chunk riêng trong database và để child row chỉ reference parent id/index.

## Embed Và Index

Lab dùng `createDeterministicEmbedding()` để chạy offline. Production sẽ thay bằng embedding provider thật,
nhưng repository contract không đổi:

- Document được tạo một lần trong `rag_documents`.
- Từng chunk được insert vào `rag_document_chunks`.
- Metadata page/parser/chunking đi kèm content và embedding.

Đây là nền tảng cho citation về sau: câu trả lời RAG chỉ nên trích dẫn document/page nằm trong retrieved
context, không để model tự tạo citation.

## Document Versioning Và Re-indexing

`IngestionPipeline` có thể nhận `versionStore` để quản lý checksum/version:

- `createDocumentChecksum()` tạo SHA-256 từ `mimeType` và `content`.
- `buildIngestionDocumentKey()` định danh tài liệu theo tenant, owner và `sourceUri`.
- Nếu cùng document key và cùng checksum đã tồn tại, pipeline trả `status: "skipped_duplicate"` và không tạo
  document/chunk mới.
- Nếu cùng document key nhưng checksum đổi, pipeline tạo version mới, ví dụ `version: 2`, rồi index chunk mới.

Trong lab, chunk metadata có thêm:

- `checksum`: checksum của nội dung đã ingest.
- `version`: version của tài liệu.
- `sourceUri`: document key dùng để nhận diện cùng một tài liệu qua các lần upload.

Trade-off production:

- Không nên xóa version cũ ngay khi re-index, vì user có thể đang xem citation từ version cũ.
- Nên có trạng thái version như `active`, `superseded`, `failed` để retrieval chỉ lấy version active.
- Re-index nên chạy trong background job; nếu version mới fail giữa chừng thì version cũ vẫn phục vụ được.
- Checksum nên tính trên nội dung đã chuẩn hóa hoặc file bytes gốc tùy mục tiêu: phát hiện file trùng tuyệt đối
  hay phát hiện nội dung text trùng sau parse.

## Chạy Lab

```powershell
cd backend
npm run learn:ingestion
```

Lab sẽ ingest một tài liệu PDF text-pages mô phỏng, sau đó query top-k từ in-memory vector repository và
in page number của các match. Lab cũng in báo cáo artifact, số chunk trung bình của `fixed-size`,
`recursive-text`, `structure-aware`, số parent/child chunk và kết quả re-upload cùng checksum để thấy trade-off.

## Upload Và Kiểm Tra File

Backend có endpoint lab:

```text
POST /api/ingestion/upload
```

Payload hiện là JSON để học validation trước khi thêm multipart upload thật:

```json
{
  "tenantId": "tenant_a",
  "ownerUserId": "user_a",
  "title": "Upload guide",
  "sourceUri": "memory://upload-guide.txt",
  "fileName": "upload-guide.txt",
  "mimeType": "text/plain",
  "contentEncoding": "utf8",
  "content": "Text cần ingest"
}
```

Endpoint kiểm tra:

- `mimeType` chỉ cho phép `text/plain` và `application/pdf`.
- `text/plain` dùng `contentEncoding: "utf8"`.
- `application/pdf` dùng `contentEncoding: "base64"` để gửi bytes PDF thật trong JSON lab.
- `content` không được rỗng.
- Kích thước tính bằng byte UTF-8 không được vượt `INGESTION_MAX_FILE_BYTES`.
- Sau khi hợp lệ, request được chuyển thành `SourceDocument` và đưa vào `IngestionPipeline`.

Giới hạn này là cố ý cho lab: multipart thật sẽ cần thêm parser upload, kiểm tra file name/path an toàn,
content-type do client gửi không được tin tuyệt đối, và có thể cần sniff magic bytes với PDF thật.

## Giới Hạn Hiện Tại

- Upload endpoint hiện dùng JSON lab, chưa phải multipart upload thật.
- PDF nhị phân thật đã parse được từ base64 bằng `pdfjs-dist`, nhưng chưa có multipart upload từ UI.
- Chưa có OCR cho scanned PDF.
- Checksum/versioning hiện mới là in-memory lab; production cần bảng version và unique constraint theo
  tenant/owner/source/checksum.
- Chưa có ingestion job status và error recovery.
