import "dotenv/config";

import OpenAI from "openai";
import type {
  ResponseFunctionToolCall,
  ResponseInput,
  Tool
} from "openai/resources/responses/responses";

import { FileSystemToolService, parseAllowedRoots } from "../filesystem/service.js";

const baseURL = requiredEnv("AZURE_FOUNDRY_OPENAI_BASE_URL");
const apiKey = requiredEnv("AZURE_FOUNDRY_OPENAI_API_KEY");
const deploymentName = requiredEnv("AZURE_FOUNDRY_OPENAI_DEPLOYMENT");

const files = new FileSystemToolService({
  allowedRoots: parseAllowedRoots(process.env.FILE_TOOL_ALLOWED_ROOTS ?? ""),
  allowWrite: (process.env.FILE_TOOL_ALLOW_WRITE ?? "false").toLowerCase() === "true",
  allowDelete: (process.env.FILE_TOOL_ALLOW_DELETE ?? "false").toLowerCase() === "true",
  maxFileBytes: Number(process.env.FILE_TOOL_MAX_FILE_BYTES ?? 1_000_000)
});

const client = new OpenAI({
  apiKey,
  baseURL
});

const tools: Tool[] = [
  {
    type: "function",
    name: "list_files",
    description: "List files and directories inside an allowed root.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" }
      }
    }
  },
  {
    type: "function",
    name: "read_file",
    description: "Read a UTF-8 text file inside an allowed root.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" }
      },
      required: ["path"]
    }
  },
  {
    type: "function",
    name: "search_files",
    description: "Search text inside files under an allowed root.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" },
        query: { type: "string" },
        limit: { type: "integer" }
      },
      required: ["query"]
    }
  },
  {
    type: "function",
    name: "write_file",
    description: "Write a UTF-8 text file inside an allowed root.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" },
        content: { type: "string" },
        createDirs: { type: "boolean" }
      },
      required: ["path", "content"]
    }
  },
  {
    type: "function",
    name: "delete_file",
    description: "Delete a file or directory inside an allowed root.",
    strict: false,
    parameters: {
      type: "object",
      properties: {
        root: { type: "string" },
        path: { type: "string" },
        recursive: { type: "boolean" }
      },
      required: ["path"]
    }
  }
];

async function main() {
  const prompt =
    process.argv.slice(2).join(" ") ||
    "List files in the allowed root, then create notes/azure-foundry-test.txt with content: hello from Azure Foundry.";

  let input: string | ResponseInput = [
    {
      role: "system",
      content:
        "You are a cautious filesystem coding assistant. Use tools to inspect files before changing them. File write/delete tools execute immediately inside configured allowed roots only. Summarize every change."
    },
    { role: "user", content: prompt }
  ];

  const executedToolCalls = [];

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const response = await client.responses.create({
      model: deploymentName,
      input,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false
    });

    const functionCalls = response.output.filter(isFunctionToolCall);
    if (functionCalls.length === 0) {
      console.log(
        JSON.stringify(
          {
            answer: response.output_text,
            executedToolCalls
          },
          null,
          2
        )
      );
      return;
    }

    input = [];
    for (const toolCall of functionCalls) {
      const args = parseToolArguments(toolCall.arguments);
      const result = await executeTool(toolCall.name, args);
      executedToolCalls.push({ name: toolCall.name, args, result });

      input.push({
        type: "function_call_output",
        call_id: toolCall.call_id,
        output: JSON.stringify(result)
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        answer: "Stopped because the reference agent reached the maximum tool iterations.",
        executedToolCalls
      },
      null,
      2
    )
  );
}

async function executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  if (name === "list_files") {
    return await files.list(asString(args.root), asString(args.path) ?? ".");
  }

  if (name === "read_file") {
    return await files.read(asString(args.root), requiredString(args.path, "path"));
  }

  if (name === "search_files") {
    return await files.search(asString(args.root), requiredString(args.query, "query"), {
      relativePath: asString(args.path) ?? ".",
      limit: typeof args.limit === "number" ? args.limit : 50
    });
  }

  if (name === "write_file") {
    return await files.write(
      asString(args.root),
      requiredString(args.path, "path"),
      requiredString(args.content, "content"),
      { createDirs: Boolean(args.createDirs) }
    );
  }

  if (name === "delete_file") {
    return await files.delete(asString(args.root), requiredString(args.path, "path"), {
      recursive: Boolean(args.recursive),
      confirmation: "DELETE"
    });
  }

  throw new Error(`Unknown tool requested by model: ${name}`);
}

function isFunctionToolCall(item: unknown): item is ResponseFunctionToolCall {
  return Boolean(
    item &&
      typeof item === "object" &&
      "type" in item &&
      (item as { type: unknown }).type === "function_call"
  );
}

function parseToolArguments(rawArguments: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(rawArguments || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Tool arguments must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown, name: string): string {
  const result = asString(value);
  if (!result) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return result;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

await main();
