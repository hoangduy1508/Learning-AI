import { randomUUID } from "node:crypto";
import { FunctionCallingConfigMode, GoogleGenAI, Type, type Content, type FunctionDeclaration } from "@google/genai";

import type { AppConfig } from "../config.js";
import { FileSystemToolService, FileToolError, parseAllowedRoots } from "../filesystem/service.js";
import { getFakeOrderStatus } from "./order-tool.js";
import { FakeSupportTicketStore, supportTicketToolProposalSchema } from "./support-ticket-tool.js";
import { getFakeWeather } from "./weather-tool.js";

export interface ContentGenerator {
  models: {
    generateContent(params: unknown): Promise<{
      text?: string;
      functionCalls?: Array<{
        name?: string;
        args?: Record<string, unknown>;
      }>;
    }>;
  };
}

interface PendingAction {
  id: string;
  toolName: "write_file" | "delete_file" | "create_support_ticket";
  args: Record<string, unknown>;
  createdAt: string;
}

interface ExecutedAction {
  toolName: "write_file" | "delete_file" | "create_support_ticket";
  args: Record<string, unknown>;
  result: unknown;
  executedAt: string;
}

export interface ToolAuditEntry {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "success" | "error";
  autoApplied: boolean;
  createdAt: string;
  completedAt?: string;
  result?: unknown;
  error?: string;
}

export interface FileAgentResult {
  answer: string;
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>;
  approvalRequired?: PendingAction;
  executedActions?: ExecutedAction[];
}

export class FileAgentService {
  private readonly client: ContentGenerator;
  private readonly files: FileSystemToolService;
  private readonly supportTickets = new FakeSupportTicketStore();
  private readonly pendingActions = new Map<string, PendingAction>();
  private readonly auditLog: ToolAuditEntry[] = [];

  constructor(
    private readonly config: AppConfig,
    client?: ContentGenerator,
    private readonly currentUserId = "user_demo"
  ) {
    if (!client && !config.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is required for file agent");
    }
    const googleClient =
      client ??
      new GoogleGenAI({
        apiKey: config.GEMINI_API_KEY,
        httpOptions: { timeout: config.LLM_TIMEOUT_SECONDS * 1_000 }
      });
    this.client = client ?? {
      models: {
        async generateContent(params: unknown) {
          return await googleClient.models.generateContent(params as Parameters<GoogleGenAI["models"]["generateContent"]>[0]);
        }
      }
    };
    this.files = new FileSystemToolService({
      allowedRoots: parseAllowedRoots(config.FILE_TOOL_ALLOWED_ROOTS),
      allowWrite: config.FILE_TOOL_ALLOW_WRITE,
      allowDelete: config.FILE_TOOL_ALLOW_DELETE,
      maxFileBytes: config.FILE_TOOL_MAX_FILE_BYTES
    });
  }

  async chat(message: string): Promise<FileAgentResult> {
    const toolCalls: FileAgentResult["toolCalls"] = [];
    const executedActions: ExecutedAction[] = [];
    const contents: Content[] = [
      {
        role: "user",
        parts: [{ text: message }]
      }
    ];

    for (let iteration = 0; iteration < 4; iteration += 1) {
      const response = await this.client.models.generateContent({
        model: this.config.GEMINI_MODEL,
        contents,
        config: {
          systemInstruction:
            this.config.FILE_AGENT_AUTO_APPLY_WRITES
              ? "You are a cautious filesystem coding assistant. Use tools to inspect files before answering. Write and delete tools execute immediately inside the configured allowed roots. After a write/delete, summarize exactly what changed."
              : "You are a cautious filesystem coding assistant. Use tools to inspect files before answering. For write_file and delete_file, explain the proposed action and wait for approval; do not claim it was applied.",
          tools: [{ functionDeclarations: fileToolDeclarations }],
          toolConfig: {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO
            }
          }
        }
      });

      const functionCalls = response.functionCalls ?? [];
      if (functionCalls.length === 0) {
        return {
          answer: response.text ?? "",
          toolCalls,
          executedActions
        };
      }

      contents.push({
        role: "model",
        parts: functionCalls.map((call) => ({ functionCall: call }))
      });

      const functionResponses = [];
      for (const call of functionCalls) {
        const name = call.name ?? "";
        const args = (call.args ?? {}) as Record<string, unknown>;
        const auditEntry = this.createAuditEntry(name, args);

        if (name === "write_file" || name === "delete_file" || name === "create_support_ticket") {
          if (name === "create_support_ticket") {
            try {
              supportTicketToolProposalSchema.parse(args);
            } catch (error) {
              auditEntry.status = "error";
              auditEntry.completedAt = new Date().toISOString();
              auditEntry.error = error instanceof Error ? error.message : "Invalid support ticket";
              throw error;
            }

            const pending = this.createPendingAction(name, args);
            this.markAuditPending(auditEntry);
            return {
              answer: `Approval required before ${name}. Review pending action ${pending.id}.`,
              toolCalls,
              executedActions,
              approvalRequired: pending
            };
          }

          if (this.config.FILE_AGENT_AUTO_APPLY_WRITES) {
            const result = await this.executeWithAudit(auditEntry, () =>
              this.executeWriteTool(name, args)
            );
            const toolName = name;
            const executedAction: ExecutedAction = {
              toolName,
              args,
              result,
              executedAt: new Date().toISOString()
            };
            executedActions.push(executedAction);
            toolCalls.push({ name, args, result });
            functionResponses.push({
              functionResponse: {
                name,
                response: { output: result }
              }
            });
            continue;
          }

          const pending = this.createPendingAction(name, args);
          this.markAuditPending(auditEntry);
          return {
            answer: `Approval required before ${name}. Review pending action ${pending.id}.`,
            toolCalls,
            executedActions,
            approvalRequired: pending
          };
        }

        const result = await this.executeWithAudit(auditEntry, () => this.executeReadOnlyTool(name, args));
        toolCalls.push({ name, args, result });
        functionResponses.push({
          functionResponse: {
            name,
            response: { output: result }
          }
        });
      }

      contents.push({
        role: "user",
        parts: functionResponses
      });
    }

    return {
      answer: "I stopped because the agent reached the maximum number of tool iterations.",
      toolCalls,
      executedActions
    };
  }

  listPendingActions(): PendingAction[] {
    return [...this.pendingActions.values()];
  }

  listAuditLog(): ToolAuditEntry[] {
    return [...this.auditLog].reverse();
  }

  async approve(actionId: string): Promise<unknown> {
    const action = this.pendingActions.get(actionId);
    if (!action) {
      throw new FileToolError("Pending action not found", 404);
    }

    this.pendingActions.delete(actionId);
    const auditEntry = this.createAuditEntry(action.toolName, action.args, false);

    if (action.toolName === "create_support_ticket") {
      return await this.executeWithAudit(auditEntry, () =>
        this.supportTickets.create(
          {
            ...action.args,
            confirmation: "CREATE_TICKET"
          },
          this.currentUserId
        )
      );
    }

    if (action.toolName === "write_file") {
      return await this.executeWithAudit(auditEntry, () =>
        this.files.write(
          asString(action.args.root),
          requiredString(action.args.path, "path"),
          requiredString(action.args.content, "content"),
          { createDirs: Boolean(action.args.createDirs) }
        )
      );
    }

    return await this.executeWithAudit(auditEntry, () =>
      this.files.delete(asString(action.args.root), requiredString(action.args.path, "path"), {
        recursive: Boolean(action.args.recursive),
        confirmation: "DELETE"
      })
    );
  }

  private createPendingAction(
    toolName: PendingAction["toolName"],
    args: Record<string, unknown>
  ): PendingAction {
    const action = {
      id: randomUUID(),
      toolName,
      args,
      createdAt: new Date().toISOString()
    };
    this.pendingActions.set(action.id, action);
    return action;
  }

  private createAuditEntry(
    toolName: string,
    args: Record<string, unknown>,
    autoApplied = this.config.FILE_AGENT_AUTO_APPLY_WRITES
  ): ToolAuditEntry {
    const entry: ToolAuditEntry = {
      id: randomUUID(),
      toolName,
      args: redactToolArgs(args),
      status: "pending",
      autoApplied,
      createdAt: new Date().toISOString()
    };
    this.auditLog.push(entry);
    if (this.auditLog.length > 200) {
      this.auditLog.shift();
    }
    return entry;
  }

  private markAuditPending(entry: ToolAuditEntry): void {
    entry.status = "pending";
  }

  private async executeWithAudit<T>(entry: ToolAuditEntry, action: () => T | Promise<T>): Promise<T> {
    try {
      const result = await action();
      entry.status = "success";
      entry.completedAt = new Date().toISOString();
      entry.result = summarizeToolResult(result);
      return result;
    } catch (error) {
      entry.status = "error";
      entry.completedAt = new Date().toISOString();
      entry.error = error instanceof Error ? error.message : "Unknown tool error";
      throw error;
    }
  }

  private async executeReadOnlyTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (name === "get_weather") {
      return getFakeWeather(args);
    }
    if (name === "get_order_status") {
      return getFakeOrderStatus(args, this.currentUserId);
    }
    if (name === "list_files") {
      return await this.files.list(asString(args.root), asString(args.path) ?? ".");
    }
    if (name === "read_file") {
      return await this.files.read(asString(args.root), requiredString(args.path, "path"));
    }
    if (name === "search_files") {
      return await this.files.search(asString(args.root), requiredString(args.query, "query"), {
        relativePath: asString(args.path) ?? ".",
        limit: typeof args.limit === "number" ? args.limit : 50
      });
    }

    throw new FileToolError(`Unknown tool: ${name}`, 400);
  }

  private async executeWriteTool(
    name: "write_file" | "delete_file",
    args: Record<string, unknown>
  ): Promise<unknown> {
    if (name === "write_file") {
      return await this.files.write(
        asString(args.root),
        requiredString(args.path, "path"),
        requiredString(args.content, "content"),
        { createDirs: Boolean(args.createDirs) }
      );
    }

    return await this.files.delete(asString(args.root), requiredString(args.path, "path"), {
      recursive: Boolean(args.recursive),
      confirmation: "DELETE"
    });
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function requiredString(value: unknown, name: string): string {
  const result = asString(value);
  if (!result) {
    throw new FileToolError(`Missing required argument: ${name}`, 400);
  }
  return result;
}

function redactToolArgs(args: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...args };
  if (typeof redacted.content === "string") {
    redacted.content = `[redacted ${Buffer.byteLength(redacted.content, "utf8")} bytes]`;
  }
  if (typeof redacted.customerEmail === "string") {
    redacted.customerEmail = "[redacted email]";
  }
  if (typeof redacted.summary === "string") {
    redacted.summary = `[redacted ${Buffer.byteLength(redacted.summary, "utf8")} bytes]`;
  }
  return redacted;
}

function summarizeToolResult(result: unknown): unknown {
  if (!result || typeof result !== "object") {
    return result;
  }

  if ("content" in result && typeof result.content === "string") {
    return {
      ...result,
      content: `[redacted ${Buffer.byteLength(result.content, "utf8")} bytes]`
    };
  }

  return result;
}

const fileToolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_weather",
    description:
      "Get fake deterministic weather for a location. Use this for weather questions in the learning app; it does not call a real external weather API.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING },
        unit: { type: Type.STRING, enum: ["celsius", "fahrenheit"] }
      },
      required: ["location"]
    }
  },
  {
    name: "get_order_status",
    description:
      "Read the status of a fake order owned by the current authenticated user. The backend, not the model, enforces order ownership.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderId: { type: Type.STRING }
      },
      required: ["orderId"]
    }
  },
  {
    name: "create_support_ticket",
    description:
      "Propose a support ticket to create for the current user. This write action requires human approval; include a stable idempotencyKey so retries do not create duplicate tickets.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING },
        category: { type: Type.STRING, enum: ["billing", "technical", "account", "general"] },
        priority: { type: Type.STRING, enum: ["low", "medium", "high"] },
        customerEmail: { type: Type.STRING },
        summary: { type: Type.STRING },
        idempotencyKey: { type: Type.STRING }
      },
      required: ["title", "category", "priority", "summary", "idempotencyKey"]
    }
  },
  {
    name: "list_files",
    description: "List files and directories inside an allowed root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { type: Type.STRING },
        path: { type: Type.STRING }
      }
    }
  },
  {
    name: "read_file",
    description: "Read a UTF-8 text file inside an allowed root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { type: Type.STRING },
        path: { type: Type.STRING }
      },
      required: ["path"]
    }
  },
  {
    name: "search_files",
    description: "Search text inside files under an allowed root.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { type: Type.STRING },
        path: { type: Type.STRING },
        query: { type: Type.STRING },
        limit: { type: Type.INTEGER }
      },
      required: ["query"]
    }
  },
  {
    name: "write_file",
    description:
      "Write a UTF-8 text file inside an allowed root. The backend may execute this immediately when auto-apply is enabled.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { type: Type.STRING },
        path: { type: Type.STRING },
        content: { type: Type.STRING },
        createDirs: { type: Type.BOOLEAN }
      },
      required: ["path", "content"]
    }
  },
  {
    name: "delete_file",
    description:
      "Delete a file or directory inside an allowed root. The backend may execute this immediately when auto-apply is enabled.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        root: { type: Type.STRING },
        path: { type: Type.STRING },
        recursive: { type: Type.BOOLEAN }
      },
      required: ["path"]
    }
  }
];
