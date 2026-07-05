# AI Learning Frontend

ReactJS + TypeScript UI for Project 1: Streaming AI Chat.

## Setup

```powershell
cd frontend
npm install
```

## Run

Start the backend first:

```powershell
cd ../backend
npm run build
npm start
```

Then start the frontend in another terminal:

```powershell
cd ../frontend
npm run dev
```

Open <http://127.0.0.1:5173>.

## Demo surface

The streaming chat tab shows:

- Incremental model output.
- Conversation id for persisted threads.
- Provider/model metadata.
- Token usage, latency, and estimated request cost.
- Per-user telemetry summary for `demo-user` when backend persistence is enabled.

The file agent tab shows:

- Tool calls and results.
- Executed write/delete actions.
- Pending action fallback and tool audit log.

## Verify

```powershell
npm run typecheck
npm test
npm run build
```
