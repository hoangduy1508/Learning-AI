# Conversation Persistence

## Muc tieu

Conversation persistence tach thanh hai bang:

- `conversations`: metadata cua thread chat va owner.
- `conversation_messages`: tung message theo thu tu thoi gian, kem provider/model/usage cho assistant output.

Schema SQL nam tai `backend/src/conversations/schema.sql`.

## Boundary quan trong

- Client co the gui `conversationId` de tiep tuc thread, nhung backend phai kiem tra `userId` so huu conversation truoc khi append message.
- Model khong duoc quyet dinh `userId`, `conversationId` hay ownership. Day la application state.
- Message cua user duoc luu sau khi request hop le. Message cua assistant chi duoc luu khi provider tra loi thanh cong.
- Usage duoc luu tren assistant message de tinh cost theo request/user ve sau.
- History cu la untrusted conversation content. Khi render history vao prompt, backend tach history khoi current user message va noi ro no khong phai system instruction.

## Context window policy

`backend/src/conversations/context.ts` chon history bang sliding window don gian:

- Chi lay cac message gan nhat, mac dinh toi da 12 message.
- Uoc tinh token theo ky tu de co guardrail truoc khi goi provider.
- Dung budget history mac dinh 2,000 estimated token.
- Message rieng le qua dai bi truncate phan dau va giu lai phan cuoi gan day.
- Current user message khong bi thay doi khi luu database; chi prompt gui sang provider moi duoc render kem history da cat gon.

Day chua phai summarization hoac compaction day du. Khi conversation dai hon nua, buoc tiep theo la tao summary message rieng, luu summary vao application state va ket hop summary + sliding window gan nhat.

## Retry policy

`backend/src/providers/retry.ts` boc provider call bang retry policy:

- Mac dinh toi da 3 attempts, tinh ca lan goi dau tien.
- Delay tang theo exponential backoff: base delay, gap doi theo moi lan fail va cap boi max delay.
- Jitter them giao dong nho de tranh nhieu request retry cung luc.
- Chi retry `LlmProviderError` co `retryable: true`.
- Timeout, rate limit va mot so loi 5xx tam thoi duoc coi la retryable. Auth, permission, insufficient quota va validation/schema error khong retry.

Cac bien moi truong co the chinh policy:

```text
LLM_RETRY_MAX_ATTEMPTS=3
LLM_RETRY_BASE_DELAY_MS=250
LLM_RETRY_MAX_DELAY_MS=2000
LLM_RETRY_JITTER_RATIO=0.2
```

## PostgreSQL shape

`conversations` co index `(user_id, updated_at DESC)` de list conversation gan day theo user.

`conversation_messages` co index `(conversation_id, created_at ASC)` de lay history dung thu tu. Token usage duoc tach cot thay vi nhet JSON de de aggregate cost/usage.

## Hien tai da noi vao app

`buildApp` nhan optional `conversationRepository`. Trong test route dang dung `InMemoryConversationRepository` de kiem chung contract ma khong can PostgreSQL runtime.

Server production/dev co the bat persistence that bang cac bien moi truong:

```text
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/ai_learning
DATABASE_SSL=false
DATABASE_RUN_MIGRATIONS=true
```

Khi `DATABASE_URL` duoc set, `src/server.ts` tao `pg.Pool` va noi `PostgresConversationRepository` vao `/api/chat`. Khi `DATABASE_RUN_MIGRATIONS=true`, server chay schema idempotent truoc khi listen.

## Kiem chung

- Route tests dung in-memory repository de kiem chung create conversation, append conversation dung owner va chan wrong-owner.
- `tests/conversation-postgres.test.ts` dung fake database client de kiem chung migration SQL, parameter binding va row mapping cua `PostgresConversationRepository`.
- `npm run smoke:conversation-db` chay migration vao PostgreSQL that, gui 2 request `/api/chat`, xac nhan co 4 message persisted va wrong-owner bi chan `404`.

## Chay local PostgreSQL

Tu root repository:

```text
docker compose up -d postgres
```

Neu chay Docker trong WSL, dung duong dan repo duoi `/mnt/e`:

```text
cd /mnt/e/Project/AI-learning
docker compose up -d postgres
```

Tu `backend/`:

```text
$env:DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/ai_learning"
$env:DATABASE_RUN_MIGRATIONS="true"
npm run smoke:conversation-db
```

Neu chay smoke test ben trong WSL thay vi PowerShell:

```text
cd /mnt/e/Project/AI-learning/backend
DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/ai_learning" DATABASE_RUN_MIGRATIONS="true" npm run smoke:conversation-db
```
