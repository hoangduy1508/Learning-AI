# Embeddings and pgvector

## Mục tiêu

Tuần 5 bắt đầu với lớp lưu trữ cho RAG:

- Chạy PostgreSQL có extension pgvector.
- Hiểu embedding là vector số có dimension cố định.
- Tạo schema documents/chunks có tenant/user metadata.
- Query top-k bằng cosine distance.

## Embedding và dimension

Embedding biến text thành mảng số. Mỗi model embedding có dimension cố định, ví dụ 384, 768,
1536 hoặc lớn hơn tùy model. Một cột `vector(n)` trong pgvector chỉ nhận embedding đúng `n`
chiều. Nếu table là `vector(768)` thì vector 767 hoặc 769 chiều phải bị reject.

Trong lab hiện tại, `backend/src/embeddings/deterministic.ts` tạo embedding deterministic 4 chiều
để test và smoke script không cần gọi provider thật. Đây không phải embedding semantic production;
nó chỉ giúp học shape của vector và query.

## Similarity metrics

- Cosine similarity đo hướng của hai vector. Càng gần 1 càng cùng hướng.
- Cosine distance trong pgvector với `vector_cosine_ops` là giá trị để sort tăng dần; càng nhỏ
  càng gần.
- Dot product nhạy với cả hướng và độ dài vector.
- L2 distance là khoảng cách Euclidean.

Nếu embedding đã normalize về magnitude 1, cosine và dot product có quan hệ rất gần. Nếu chưa
normalize, metric có thể cho ranking khác nhau.

## Exact và approximate nearest neighbor

Exact nearest-neighbor search tính distance giữa query vector và mọi chunk sau khi filter, rồi sort
toàn bộ kết quả. Cách này dễ hiểu, deterministic và rất tốt cho dataset nhỏ, nhưng sẽ chậm khi số
chunk lớn.

Approximate nearest-neighbor search dùng index để tìm ứng viên gần đúng thay vì scan toàn bộ bảng.
Đổi lại, kết quả có thể bỏ sót một số neighbor thật sự gần nhất. Vì vậy production thường phải đo
recall/latency thay vì chỉ nhìn demo thủ công.

- HNSW tạo graph nhiều lớp để đi nhanh tới vùng vector gần query. HNSW thường query nhanh và recall
  tốt, nhưng tốn memory và thời gian build index.
- IVFFlat chia vector space thành nhiều list/cluster. Query chỉ probe một số list, nên nhanh hơn
  exact scan trên dataset lớn nhưng cần dữ liệu đủ nhiều để train/build index có ý nghĩa.
- Với dataset rất nhỏ, exact scan thường dễ debug hơn và có thể nhanh hơn index approximate.

## Schema

Schema nằm tại `backend/src/vector/schema.ts`:

- `rag_documents`: metadata của document.
- `rag_document_chunks`: từng chunk, metadata JSON, tenant/user ownership và `embedding vector(4)`.
- Index `(tenant_id, owner_user_id)` để filter quyền trước.
- HNSW index `embedding vector_cosine_ops` để sẵn sàng cho approximate nearest neighbor.

Query retrieval phải filter tenant/user trước khi trả context:

```sql
SELECT content, embedding <=> $1::vector AS distance
FROM rag_document_chunks
WHERE tenant_id = $2 AND owner_user_id = $3
ORDER BY embedding <=> $1::vector
LIMIT 5;
```

`backend/src/vector/repository.ts` bọc các thao tác chính:

- `createDocument()` lưu metadata document.
- `insertChunk()` lưu content, metadata JSON và embedding.
- `searchTopK()` bắt buộc nhận `tenantId`, `ownerUserId`, query embedding, `topK` và optional metadata
  filter.

Metadata filter được áp dụng cùng với tenant/user filter trước khi sort theo vector distance. Đây là
điểm security quan trọng: model không được nhìn thấy chunk ngoài quyền user rồi mới tự quyết định bỏ
qua.

## So sánh kết quả với nhiều query

Chạy lab offline không cần PostgreSQL:

```powershell
cd backend
npm run learn:retrieval
```

Lab này seed bốn chunk về `vector`, `backend`, `frontend` và `security`, sau đó chạy nhiều query để
so sánh top-k. Mục tiêu là quan sát ba điều:

- Query khác nhau tạo query embedding khác nhau, nên thứ tự top-k thay đổi.
- Distance nhỏ hơn nghĩa là vector gần hơn, nhưng không tự động đảm bảo câu trả lời đúng.
- Embedding dimension quá nhỏ hoặc embedding model kém có thể làm collision, khiến kết quả gần nhất
  không đúng nghĩa nhất.

Trong smoke pgvector hiện tại, schema dùng `vector(4)` để lab nhỏ và dễ thấy lỗi dimension mismatch.
Trong lab so sánh offline, code dùng dimension lớn hơn để giảm collision và làm ranking dễ quan sát
hơn. Production phải dùng đúng dimension của embedding provider đã chọn.

## Chạy PostgreSQL + pgvector

Root `docker-compose.yml` dùng image:

```text
pgvector/pgvector:pg16
```

Chạy container:

```powershell
docker compose up -d postgres
```

Nếu Docker chỉ có trong WSL, chạy từ đường dẫn repo WSL:

```bash
cd /mnt/e/Project/AI-learning
docker compose up -d postgres
```

Smoke test:

```powershell
cd backend
$env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/ai_learning"
npm run smoke:pgvector
```

Smoke test sẽ:

- `CREATE EXTENSION IF NOT EXISTS vector`.
- Tạo schema documents/chunks.
- Insert 3 chunks với embedding deterministic 4 chiều.
- Query top-k bằng cosine distance `<=>`.
- Thử insert vector 3 chiều vào cột `vector(4)` và xác nhận pgvector reject.

## Giới hạn hiện tại

- Chưa dùng embedding provider thật; sẽ thêm provider embedding trong các bước RAG tiếp theo.
- Dimension 4 chỉ để lab nhỏ. Production phải dùng dimension đúng với model embedding đã chọn.
- HNSW index có lợi cho dataset lớn, nhưng với dataset rất nhỏ exact scan có thể nhanh và dễ debug
  hơn.
