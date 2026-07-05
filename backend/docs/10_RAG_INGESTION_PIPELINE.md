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

Pipeline mac dinh van dung `chunkCleanedPages()` voi recursive text splitting:

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
- `sectionTitle`: section heading neu strategy co the nhan dien.
- `tokenEstimate`: uoc tinh token don gian de quan sat kich thuoc chunk.

## So sanh chunking strategies

Module `backend/src/ingestion/chunking.ts` co ba strategy de so sanh:

- `fixed-size`: cat theo so ky tu co dinh. Don gian, deterministic, de batch, nhung co the cat ngang cau,
  bang hoac heading.
- `recursive-text`: uu tien paragraph/newline/cau/space truoc khi hard cut. Day la default tot cho text
  chung vi giu boundary tu nhien hon fixed-size.
- `structure-aware`: nhan dien heading Markdown va chunk theo section truoc, sau do moi recursive split trong
  section. Cach nay huu ich voi tai lieu co heading ro rang vi chunk co them `sectionTitle`, nhung se kem tac
  dung voi PDF parse ra text mat cau truc.

Trade-off quan trong:

- Chunk qua nho: retrieval co the lay dung keyword nhung thieu ngu canh de answer.
- Chunk qua lon: it mat context hon nhung tang token, giam do chinh xac cua top-k va lam prompt nang hon.
- Overlap giup giu ngu canh o bien chunk, nhung overlap cao lam tang so chunk va chi phi embedding.
- Structure-aware tot khi parser giu duoc heading/list/table; neu parser lam mat cau truc thi phai fallback
  ve recursive/fixed-size.

## Overlap va parent-child chunking

Overlap copy mot phan cuoi cua chunk truoc sang chunk sau. Loi ich la query van co the match khi y quan trong
nam ngay bien chunk. Cai gia phai tra la:

- Nhieu chunk hon.
- Nhieu embedding hon.
- Retrieved context de bi lap lai noi dung.

Parent-child chunking giai quyet mot trade-off khac:

- Parent chunk lon hon, thuong la page hoac section, de giu ngu canh doc hieu.
- Child chunk nho hon, co overlap, duoc embed va dung de vector search.
- Khi child chunk match query, metadata `parentChunkIndex` va `parentSectionTitle` cho phep he thong lay parent
  context rong hon de tao cau tra loi.

Trong lab, `createParentChildChunks()` tao parent bang structure-aware chunking, sau do cat parent thanh child
chunk nho hon. Child chunk luu metadata:

- `parentChunkIndex`: parent trong cung document/page.
- `parentSectionTitle`: heading cua section neu co.
- `childOverlapCharacters`: overlap da dung khi cat child.

Production thuong khong nen dua toan bo parent vao moi metadata row neu parent qua lon. Tot hon la luu parent
chunk rieng trong database va de child row chi reference parent id/index.

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
in page number cua cac match. Lab cung in so chunk trung binh cua `fixed-size`, `recursive-text`,
`structure-aware` va so parent/child chunk de thay trade-off.

## Gioi han hien tai

- Chua co upload endpoint va file size/type validation.
- Chua parse PDF nhi phan that.
- Chua co OCR cho scanned PDF.
- Chua co checksum/document versioning de tranh xu ly trung.
- Chua co ingestion job status va error recovery.
