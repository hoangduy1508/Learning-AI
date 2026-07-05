# RAG Ingestion Pipeline

## Muc tieu

Tuan 6 bat dau bang pipeline dua tai lieu vao vector index:

- Parse tai lieu thanh text co page number.
- Clean text de giam nhieu truoc khi chunk.
- Chunk text thanh cac passage co kich thuoc on dinh.
- Embed tung chunk.
- Index chunk kem metadata de retrieval co the trace ve document/page.

## Flow

Pipeline hien nam tai `backend/src/ingestion/pipeline.ts`:

```text
SourceDocument
  -> parseSourceDocument()
  -> cleanParsedDocument()
  -> chunkCleanedPages()
  -> createDeterministicEmbedding()
  -> VectorRepository.createDocument()/insertChunk()
```

Trong lab nay, `application/pdf` duoc mo phong bang plain text co delimiter `---page---`.
Dieu quan trong can hoc o buoc nay la contract cua ingestion: parser phai tra ve page number,
chunk phai giu metadata page, va index phai luu metadata do cung embedding.

PDF parser nhi phan that se duoc them o task tiep theo. Scanned PDF/OCR cung la mot nhanh rieng:
neu parser khong lay duoc text, ingestion job can danh dau loi ro rang thay vi tao chunk rong.

## Parse

`parseSourceDocument()` tra ve `ParsedDocument` gom:

- `parser`: loai parser da dung.
- `pages`: mang `{ pageNumber, text }`.
- `title` va `sourceUri`.

Plain text mac dinh la mot page. PDF text pages tach theo `---page---` de lab co the kiem chung
page trace ma chua can dependency parse PDF.

## Clean

`cleanText()` xu ly cac loi thuong gap sau parse:

- Chuan hoa CRLF ve LF.
- Bo trailing spaces truoc newline.
- Gop nhieu dong trong thanh toi da hai newline.
- Gop nhieu space/tab thanh mot space.
- Trim dau/cuoi document.

Cleaning nen duoc lam truoc chunking vi whitespace nhieu lam chunk bi cat vo nghia va tang token
khong can thiet.

## Chunk

`chunkCleanedPages()` dang dung recursive text splitting:

1. Uu tien cat theo paragraph.
2. Neu khong duoc, cat theo newline.
3. Sau do cat theo cau.
4. Cuoi cung moi cat theo space hoac hard limit.

Chunk co `overlapCharacters` de chunk sau mang mot phan ngu canh tu chunk truoc. Overlap giup retrieval
khong mat thong tin nam ngay bien chunk, nhung overlap qua lon se tang so chunk, token, chi phi embedding
va nguy co duplicate context.

Moi chunk luu metadata:

- `page`: page number de citation.
- `parser`: parser da tao text.
- `chunking`: strategy da dung.
- `tokenEstimate`: uoc tinh token don gian de quan sat kich thuoc chunk.

## Embed va index

Lab dung `createDeterministicEmbedding()` de chay offline. Production se thay bang embedding provider that,
nhung repository contract khong doi:

- Document duoc tao mot lan trong `rag_documents`.
- Tung chunk duoc insert vao `rag_document_chunks`.
- Metadata page/parser/chunking di kem content va embedding.

Day la nen tang cho citation ve sau: cau tra loi RAG chi nen trich dan document/page nam trong retrieved
context, khong de model tu tao citation.

## Chay lab

```powershell
cd backend
npm run learn:ingestion
```

Lab se ingest mot tai lieu PDF text-pages mo phong, sau do query top-k tu in-memory vector repository va
in page number cua cac match.

## Gioi han hien tai

- Chua co upload endpoint va file size/type validation.
- Chua parse PDF nhi phan that.
- Chua co OCR cho scanned PDF.
- Chua co checksum/document versioning de tranh xu ly trung.
- Chua co ingestion job status va error recovery.
