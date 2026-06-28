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

## PostgreSQL shape

`conversations` co index `(user_id, updated_at DESC)` de list conversation gan day theo user.

`conversation_messages` co index `(conversation_id, created_at ASC)` de lay history dung thu tu. Token usage duoc tach cot thay vi nhet JSON de de aggregate cost/usage.

## Hien tai da noi vao app

`buildApp` nhan optional `conversationRepository`. Trong test dang dung `InMemoryConversationRepository` de kiem chung contract ma khong can PostgreSQL runtime. Buoc tiep theo la them driver PostgreSQL/Drizzle va implementation repository that dua tren schema nay.
