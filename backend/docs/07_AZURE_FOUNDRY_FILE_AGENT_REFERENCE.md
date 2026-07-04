# Azure Foundry OpenAI File Agent Reference

This is a standalone reference implementation for tool calling with an Azure AI Foundry / Azure OpenAI OpenAI-compatible endpoint.

It uses the **Responses API** through the OpenAI TypeScript SDK:

```ts
await client.responses.create(...)
```

It is not registered in the current Fastify API routes and does not replace the Gemini provider flow.

## What It Demonstrates

```text
User prompt
  |
OpenAI-compatible Azure Foundry client
  |
Responses API output item: function_call
  |
Local TypeScript code validates and executes tools
  |
Responses API input item: function_call_output
  |
Final answer is printed
```

The model never directly edits files. It only returns a structured `function_call`. The local script executes the actual filesystem action through `FileSystemToolService`.

## Environment

Add these values to `backend/.env`:

```env
AZURE_FOUNDRY_OPENAI_BASE_URL=https://YOUR-RESOURCE-NAME.openai.azure.com/openai/v1/
AZURE_FOUNDRY_OPENAI_API_KEY=your-key
AZURE_FOUNDRY_OPENAI_DEPLOYMENT=your-deployment-name
```

The script reuses existing filesystem guard variables:

```env
FILE_TOOL_ALLOWED_ROOTS=E:\Project\3sdesign
FILE_TOOL_ALLOW_WRITE=true
FILE_TOOL_ALLOW_DELETE=true
FILE_TOOL_MAX_FILE_BYTES=1000000
```

## Run

```powershell
cd E:\Project\AI-learning\backend
npm run reference:azure-foundry-agent -- "List files, then create notes/azure-test.txt with content hello"
```

## Tools

The script exposes these function tools to the model:

- `list_files`
- `read_file`
- `search_files`
- `write_file`
- `delete_file`

Write and delete execute immediately if the existing filesystem env flags allow them.

## Responses API Loop

1. Send the initial `input` and `tools` to `client.responses.create`.
2. Inspect `response.output` for `function_call` items.
3. Execute each requested function locally.
4. Send `function_call_output` items back as the next `input`.
5. Stop when the model returns no more function calls and read `response.output_text`.

## Security Notes

- Keep `FILE_TOOL_ALLOWED_ROOTS` narrow.
- Do not point this script at company/private code unless sending file metadata/content to Azure OpenAI is allowed.
- The model can propose a tool call, but local code must still validate path, size, and permission.
- Keep API keys only in `.env` or a secret manager.

## Vietnamese Notes

Script nay dung Azure Foundry/OpenAI SDK voi Responses API de minh hoa tool calling.

Model chi tra ve `function_call`; code TypeScript local moi la noi that su doc, ghi hoac xoa file.

Script nay khong duoc gan vao API hien tai. Day chi la file tham khao de so sanh voi flow Gemini dang dung.
