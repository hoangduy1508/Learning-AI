# AI Learning Backend

Node.js + TypeScript service for Week 1 of the AI Integration learning plan.

## Requirements

- Node.js 20 or newer

## Setup

```powershell
cd backend
npm install
Copy-Item .env.example .env
```

The default `LLM_PROVIDER=fake` works without credentials. The route contract is independent
of the selected provider.

## Run

```powershell
npm run dev
```

Call the API with:

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/api/chat `
  -ContentType "application/json" `
  -Body '{"message":"Explain what an LLM token is"}'
```

## Use OpenAI

Edit `.env` without committing it:

```dotenv
LLM_PROVIDER=openai
OPENAI_API_KEY=your_api_key
OPENAI_MODEL=gpt-4.1-mini
```

The API key stays in the Node.js backend and is never sent to the React application.

## Use Gemini

```dotenv
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_api_key
GEMINI_MODEL=gemini-3.5-flash
```

Select exactly one provider with `LLM_PROVIDER`. Provider credentials remain on the backend.
To add another provider later, implement `LlmProvider` and register it in
`src/providers/index.ts`; routes and frontend code do not need to change.

## Verify

```powershell
npm run typecheck
npm test
npm run build
```

## Token lab

```powershell
npm run learn:tokens
```

See [Tokens and Context](docs/TOKENS_AND_CONTEXT.md) for the concepts and interpretation.

## Generation controls lab

```powershell
npm run learn:generation
```

See [Generation Controls](docs/GENERATION_CONTROLS.md) for system instructions, temperature,
output limits, and stop conditions.
