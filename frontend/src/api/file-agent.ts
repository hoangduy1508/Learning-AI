export interface AgentToolCall {
  name: string;
  args: Record<string, unknown>;
  result: unknown;
}

export interface PendingAction {
  id: string;
  toolName: "write_file" | "delete_file" | "create_support_ticket";
  args: Record<string, unknown>;
  createdAt: string;
}

export interface AgentChatResponse {
  answer: string;
  toolCalls: AgentToolCall[];
  approvalRequired?: PendingAction;
  executedActions?: ExecutedAction[];
}

export interface PendingActionsResponse {
  actions: PendingAction[];
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

export interface ToolAuditResponse {
  entries: ToolAuditEntry[];
}

export interface ExecutedAction {
  toolName: "write_file" | "delete_file" | "create_support_ticket";
  args: Record<string, unknown>;
  result: unknown;
  executedAt: string;
}

export async function chatWithFileAgent(message: string): Promise<AgentChatResponse> {
  return await requestJson<AgentChatResponse>("/api/agent/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message })
  });
}

export async function listPendingActions(): Promise<PendingAction[]> {
  const response = await requestJson<PendingActionsResponse>("/api/agent/pending");
  return response.actions;
}

export async function listToolAudit(): Promise<ToolAuditEntry[]> {
  const response = await requestJson<ToolAuditResponse>("/api/agent/audit");
  return response.entries;
}

export async function approvePendingAction(actionId: string): Promise<unknown> {
  return await requestJson<unknown>("/api/agent/approve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ actionId })
  });
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const text = await response.text();
  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : `Request failed with status ${response.status}`;
    throw new Error(detail);
  }

  return data as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
