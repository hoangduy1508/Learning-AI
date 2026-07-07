import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  approvePendingAction,
  chatWithFileAgent,
  listPendingActions,
  listToolAudit,
  type AgentChatResponse,
  type PendingAction,
  type ToolAuditEntry
} from "./api/file-agent";
import { getCostSummary, type CostSummary } from "./api/cost-summary";
import { streamChat } from "./api/chat-stream";
import {
  extractSupportTicket,
  type StructuredSupportTicketResult
} from "./api/structured";
import type { StreamEvent } from "./lib/stream-events";
import "./styles.css";

interface UsageView {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
  latencyMs: number;
  estimatedCostUsd?: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "done" | "error" | "stopped";
  usage?: UsageView;
  metadata?: { provider: string; model: string };
}

type AppView = "chat" | "structured" | "tools";
type StreamStatus = "idle" | "streaming" | "done" | "error" | "stopped";
type RequestStatus = "idle" | "loading" | "done" | "error";

const conversationStorageKey = "ai-learning.project1.conversation";
const userStorageKey = "ai-learning.project1.user";

export default function App() {
  const [activeView, setActiveView] = useState<AppView>("chat");
  const [userId, setUserId] = useState(() => localStorage.getItem(userStorageKey) ?? "demo-user");
  const [message, setMessage] = useState("Giải thích HTTP streaming trong 2 câu ngắn.");
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredConversation().messages);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(
    () => loadStoredConversation().conversationId
  );
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null);
  const [costSummaryError, setCostSummaryError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [structuredMessage, setStructuredMessage] = useState(
    "Khách hàng linh@example.com báo không tải được hóa đơn tháng này và đang rất gấp."
  );
  const [structuredStatus, setStructuredStatus] = useState<RequestStatus>("idle");
  const [structuredResult, setStructuredResult] = useState<StructuredSupportTicketResult | null>(null);
  const [structuredError, setStructuredError] = useState<string | null>(null);

  const [agentMessage, setAgentMessage] = useState(
    "Cho biết thời tiết ở Ho Chi Minh City theo celsius, rồi tạo ticket nếu cần hỗ trợ."
  );
  const [agentStatus, setAgentStatus] = useState<RequestStatus>("idle");
  const [agentResult, setAgentResult] = useState<AgentChatResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [toolAuditEntries, setToolAuditEntries] = useState<ToolAuditEntry[]>([]);
  const [approvalResult, setApprovalResult] = useState<unknown>(null);

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((entry) => entry.role === "assistant"),
    [messages]
  );

  useEffect(() => {
    localStorage.setItem(userStorageKey, userId);
  }, [userId]);

  useEffect(() => {
    localStorage.setItem(
      conversationStorageKey,
      JSON.stringify({
        conversationId,
        messages
      })
    );
  }, [conversationId, messages]);

  useEffect(() => {
    void refreshCostSummary();
    void refreshPendingActions();
    void refreshToolAudit();
  }, []);

  async function handleChatSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || status === "streaming") {
      return;
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedMessage,
      status: "done"
    };
    const assistantMessageId = crypto.randomUUID();
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      status: "streaming"
    };
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setMessage("");
    setError(null);
    setStatus("streaming");

    try {
      await streamChat({
        message: trimmedMessage,
        userId,
        conversationId,
        signal: abortController.signal,
        onEvent: (streamEvent) => handleStreamEvent(streamEvent, assistantMessageId)
      });

      if (!abortController.signal.aborted) {
        setStatus("done");
        updateAssistantMessage(assistantMessageId, { status: "done" });
        await refreshCostSummary();
      }
    } catch (streamError) {
      if (abortController.signal.aborted) {
        setStatus("stopped");
        updateAssistantMessage(assistantMessageId, { status: "stopped" });
        return;
      }

      const messageText =
        streamError instanceof Error ? streamError.message : "Lỗi streaming không xác định";
      setError(messageText);
      setStatus("error");
      updateAssistantMessage(assistantMessageId, {
        status: "error",
        content: messageText
      });
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleStreamEvent(streamEvent: StreamEvent, assistantMessageId: string) {
    if (streamEvent.type === "start") {
      if (streamEvent.conversationId) {
        setConversationId(streamEvent.conversationId);
      }
      updateAssistantMessage(assistantMessageId, {
        metadata: { provider: streamEvent.provider, model: streamEvent.model }
      });
    }

    if (streamEvent.type === "delta") {
      setMessages((current) =>
        current.map((entry) =>
          entry.id === assistantMessageId
            ? { ...entry, content: `${entry.content}${streamEvent.text}` }
            : entry
        )
      );
    }

    if (streamEvent.type === "usage") {
      updateAssistantMessage(assistantMessageId, {
        usage: {
          inputTokens: streamEvent.usage.inputTokens,
          outputTokens: streamEvent.usage.outputTokens,
          thinkingTokens: streamEvent.usage.thinkingTokens,
          totalTokens: streamEvent.usage.totalTokens,
          latencyMs: streamEvent.latencyMs,
          estimatedCostUsd: streamEvent.estimatedCostUsd
        }
      });
    }

    if (streamEvent.type === "error") {
      setError(streamEvent.message);
      setStatus("error");
      updateAssistantMessage(assistantMessageId, {
        status: "error",
        content: streamEvent.message
      });
    }
  }

  function updateAssistantMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
    );
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
    setStatus("stopped");
    setMessages((current) =>
      current.map((entry) =>
        entry.role === "assistant" && entry.status === "streaming"
          ? { ...entry, status: "stopped" }
          : entry
      )
    );
  }

  function startNewConversation() {
    abortControllerRef.current?.abort();
    setConversationId(undefined);
    setMessages([]);
    setStatus("idle");
    setError(null);
    localStorage.removeItem(conversationStorageKey);
  }

  async function refreshCostSummary() {
    setCostSummaryError(null);
    try {
      setCostSummary(await getCostSummary(userId));
    } catch (summaryError) {
      setCostSummary(null);
      setCostSummaryError(
        summaryError instanceof Error ? summaryError.message : "Không tải được cost summary"
      );
    }
  }

  async function handleStructuredSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = structuredMessage.trim();
    if (!trimmedMessage || structuredStatus === "loading") {
      return;
    }

    setStructuredStatus("loading");
    setStructuredError(null);
    setStructuredResult(null);

    try {
      setStructuredResult(await extractSupportTicket(trimmedMessage));
      setStructuredStatus("done");
    } catch (structuredRequestError) {
      setStructuredError(
        structuredRequestError instanceof Error
          ? structuredRequestError.message
          : "Không extract được structured output"
      );
      setStructuredStatus("error");
    }
  }

  async function handleAgentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = agentMessage.trim();
    if (!trimmedMessage || agentStatus === "loading") {
      return;
    }

    setAgentStatus("loading");
    setAgentResult(null);
    setApprovalResult(null);
    setAgentError(null);

    try {
      const response = await chatWithFileAgent(trimmedMessage);
      setAgentResult(response);
      setAgentStatus("done");
      await refreshPendingActions();
      await refreshToolAudit();
    } catch (agentRequestError) {
      setAgentError(
        agentRequestError instanceof Error ? agentRequestError.message : "Lỗi agent không xác định"
      );
      setAgentStatus("error");
    }
  }

  async function refreshPendingActions() {
    try {
      setPendingActions(await listPendingActions());
    } catch (pendingError) {
      setAgentError(
        pendingError instanceof Error ? pendingError.message : "Không tải được pending actions"
      );
    }
  }

  async function refreshToolAudit() {
    try {
      setToolAuditEntries(await listToolAudit());
    } catch (auditError) {
      setAgentError(auditError instanceof Error ? auditError.message : "Không tải được audit log");
    }
  }

  async function approveAction(actionId: string) {
    setAgentError(null);
    setApprovalResult(null);

    try {
      const result = await approvePendingAction(actionId);
      setApprovalResult(result);
      await refreshPendingActions();
      await refreshToolAudit();
    } catch (approvalError) {
      setAgentError(approvalError instanceof Error ? approvalError.message : "Duyệt action thất bại");
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-kicker">Project 1</span>
          <h1>Streaming AI Chat</h1>
        </div>

        <nav className="nav-tabs" aria-label="Project 1 views">
          <button
            type="button"
            className={activeView === "chat" ? "nav-tab active" : "nav-tab"}
            onClick={() => setActiveView("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={activeView === "structured" ? "nav-tab active" : "nav-tab"}
            onClick={() => setActiveView("structured")}
          >
            Structured
          </button>
          <button
            type="button"
            className={activeView === "tools" ? "nav-tab active" : "nav-tab"}
            onClick={() => setActiveView("tools")}
          >
            Tools
          </button>
        </nav>

        <section className="sidebar-section">
          <label htmlFor="user-id">User</label>
          <input
            id="user-id"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            disabled={status === "streaming"}
          />
        </section>

        <section className="sidebar-section">
          <div className="meta-row">
            <span>Conversation</span>
            <strong>{conversationId ? conversationId.slice(0, 8) : "new"}</strong>
          </div>
          <button type="button" className="secondary-button full-width" onClick={startNewConversation}>
            Tạo hội thoại mới
          </button>
        </section>

        <TelemetryPanel
          costSummary={costSummary}
          costSummaryError={costSummaryError}
          onRefreshCostSummary={refreshCostSummary}
        />
      </aside>

      <section className="workspace">
        {activeView === "chat" ? (
          <ChatWorkspace
            error={error}
            latestAssistant={latestAssistant}
            message={message}
            messages={messages}
            onSubmit={handleChatSubmit}
            setMessage={setMessage}
            status={status}
            stopGenerating={stopGenerating}
          />
        ) : null}

        {activeView === "structured" ? (
          <StructuredWorkspace
            error={structuredError}
            message={structuredMessage}
            onSubmit={handleStructuredSubmit}
            result={structuredResult}
            setMessage={setStructuredMessage}
            status={structuredStatus}
          />
        ) : null}

        {activeView === "tools" ? (
          <ToolsWorkspace
            agentError={agentError}
            agentMessage={agentMessage}
            agentResult={agentResult}
            agentStatus={agentStatus}
            approvalResult={approvalResult}
            onApprove={approveAction}
            onRefreshAudit={refreshToolAudit}
            onRefreshPending={refreshPendingActions}
            onSubmit={handleAgentSubmit}
            pendingActions={pendingActions}
            setAgentMessage={setAgentMessage}
            toolAuditEntries={toolAuditEntries}
          />
        ) : null}
      </section>
    </main>
  );
}

interface ChatWorkspaceProps {
  error: string | null;
  latestAssistant?: ChatMessage;
  message: string;
  messages: ChatMessage[];
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  setMessage(message: string): void;
  status: StreamStatus;
  stopGenerating(): void;
}

function ChatWorkspace(props: ChatWorkspaceProps) {
  return (
    <div className="workspace-grid">
      <section className="chat-panel">
        <header className="section-header">
          <div>
            <span className="section-kicker">Streaming</span>
            <h2>Hội thoại</h2>
          </div>
          <StatusPill status={props.status} />
        </header>

        <div className="message-list" aria-live="polite">
          {props.messages.length === 0 ? (
            <div className="empty-state">Chưa có tin nhắn.</div>
          ) : (
            props.messages.map((entry) => <MessageBubble key={entry.id} message={entry} />)
          )}
        </div>

        {props.error ? <p className="error banner">Error: {props.error}</p> : null}

        <form onSubmit={props.onSubmit} className="composer">
          <textarea
            value={props.message}
            onChange={(event) => props.setMessage(event.target.value)}
            disabled={props.status === "streaming"}
            rows={3}
            aria-label="Tin nhắn"
          />
          <div className="actions">
            <button type="submit" disabled={props.status === "streaming" || !props.message.trim()}>
              Gửi
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={props.stopGenerating}
              disabled={props.status !== "streaming"}
            >
              Dừng
            </button>
          </div>
        </form>
      </section>

      <aside className="detail-panel">
        <header className="section-header compact-header">
          <div>
            <span className="section-kicker">Telemetry</span>
            <h2>Lượt trả lời mới nhất</h2>
          </div>
        </header>
        {props.latestAssistant?.metadata ? (
          <div className="meta-list">
            <div className="meta-row">
              <span>Provider</span>
              <strong>{props.latestAssistant.metadata.provider}</strong>
            </div>
            <div className="meta-row">
              <span>Model</span>
              <strong>{props.latestAssistant.metadata.model}</strong>
            </div>
          </div>
        ) : (
          <p className="muted">Chưa có metadata.</p>
        )}
        {props.latestAssistant?.usage ? <UsageGrid usage={props.latestAssistant.usage} /> : null}
      </aside>
    </div>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={message.role === "user" ? "message user" : "message assistant"}>
      <div className="message-meta">
        <span>{message.role === "user" ? "User" : "Assistant"}</span>
        {message.status ? <span>{message.status}</span> : null}
      </div>
      <p>{message.content || (message.status === "streaming" ? "..." : "")}</p>
    </article>
  );
}

interface StructuredWorkspaceProps {
  error: string | null;
  message: string;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  result: StructuredSupportTicketResult | null;
  setMessage(message: string): void;
  status: RequestStatus;
}

function StructuredWorkspace(props: StructuredWorkspaceProps) {
  return (
    <div className="workspace-grid">
      <section className="chat-panel">
        <header className="section-header">
          <div>
            <span className="section-kicker">Structured Output</span>
            <h2>Support ticket</h2>
          </div>
          <StatusPill status={props.status} />
        </header>

        <form onSubmit={props.onSubmit} className="composer top-composer">
          <textarea
            value={props.message}
            onChange={(event) => props.setMessage(event.target.value)}
            disabled={props.status === "loading"}
            rows={5}
            aria-label="Nội dung ticket"
          />
          <div className="actions">
            <button type="submit" disabled={props.status === "loading" || !props.message.trim()}>
              Extract
            </button>
          </div>
        </form>

        {props.error ? <p className="error banner">Error: {props.error}</p> : null}

        {props.result ? (
          <section className="ticket-grid">
            <Metric label="Category" value={props.result.ticket.category} />
            <Metric label="Priority" value={props.result.ticket.priority} />
            <Metric label="Review" value={props.result.ticket.needsHumanReview ? "yes" : "no"} />
            <Metric label="Tokens" value={props.result.usage.total_tokens} />
            <article className="ticket-card">
              <h3>{props.result.ticket.title}</h3>
              <p>{props.result.ticket.summary}</p>
              <div className="meta-row">
                <span>Email</span>
                <strong>{props.result.ticket.customerEmail ?? "null"}</strong>
              </div>
            </article>
          </section>
        ) : (
          <div className="empty-state">Chưa có structured output.</div>
        )}
      </section>

      <aside className="detail-panel">
        <header className="section-header compact-header">
          <div>
            <span className="section-kicker">Validation</span>
            <h2>Raw output</h2>
          </div>
        </header>
        {props.result ? (
          <>
            <div className="meta-list">
              <div className="meta-row">
                <span>Provider</span>
                <strong>{props.result.provider}</strong>
              </div>
              <div className="meta-row">
                <span>Model</span>
                <strong>{props.result.model}</strong>
              </div>
            </div>
            <CodeBlock value={props.result.rawText} />
          </>
        ) : (
          <p className="muted">Zod validation result sẽ hiển thị ở đây.</p>
        )}
      </aside>
    </div>
  );
}

interface ToolsWorkspaceProps {
  agentError: string | null;
  agentMessage: string;
  agentResult: AgentChatResponse | null;
  agentStatus: RequestStatus;
  approvalResult: unknown;
  onApprove(actionId: string): Promise<void>;
  onRefreshAudit(): Promise<void>;
  onRefreshPending(): Promise<void>;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  pendingActions: PendingAction[];
  setAgentMessage(message: string): void;
  toolAuditEntries: ToolAuditEntry[];
}

function ToolsWorkspace(props: ToolsWorkspaceProps) {
  return (
    <div className="workspace-grid">
      <section className="chat-panel">
        <header className="section-header">
          <div>
            <span className="section-kicker">Tool Calling</span>
            <h2>Agent tools</h2>
          </div>
          <StatusPill status={props.agentStatus} />
        </header>

        <form onSubmit={props.onSubmit} className="composer top-composer">
          <textarea
            value={props.agentMessage}
            onChange={(event) => props.setAgentMessage(event.target.value)}
            disabled={props.agentStatus === "loading"}
            rows={4}
            aria-label="Agent message"
          />
          <div className="actions">
            <button
              type="submit"
              disabled={props.agentStatus === "loading" || !props.agentMessage.trim()}
            >
              Chạy
            </button>
            <button type="button" className="secondary-button" onClick={props.onRefreshPending}>
              Pending
            </button>
            <button type="button" className="secondary-button" onClick={props.onRefreshAudit}>
              Audit
            </button>
          </div>
        </form>

        {props.agentError ? <p className="error banner">Error: {props.agentError}</p> : null}

        <section className="answer-card">
          {props.agentResult ? (
            <>
              <p className="answer">{props.agentResult.answer || "Không có text answer."}</p>
              {props.agentResult.approvalRequired ? (
                <p className="warning">
                  Approval required: {props.agentResult.approvalRequired.toolName}
                </p>
              ) : null}
              {props.agentResult.executedActions?.length ? (
                <p className="success">
                  Đã thực thi {props.agentResult.executedActions.length} action.
                </p>
              ) : null}
            </>
          ) : (
            <div className="empty-state">Chưa có tool call.</div>
          )}
        </section>

        {props.agentResult?.toolCalls.length ? (
          <section className="record-list">
            <h3>Tool calls</h3>
            {props.agentResult.toolCalls.map((toolCall, index) => (
              <details key={`${toolCall.name}-${index}`} className="record-card" open>
                <summary>{toolCall.name}</summary>
                <CodeBlock value={{ args: toolCall.args, result: toolCall.result }} />
              </details>
            ))}
          </section>
        ) : null}

        {props.approvalResult !== null ? (
          <section className="record-list">
            <h3>Approval result</h3>
            <CodeBlock value={props.approvalResult} />
          </section>
        ) : null}
      </section>

      <aside className="detail-panel tall-panel">
        <header className="section-header compact-header">
          <div>
            <span className="section-kicker">Human approval</span>
            <h2>Pending actions</h2>
          </div>
        </header>
        {props.pendingActions.length === 0 ? (
          <p className="muted">Không có action chờ duyệt.</p>
        ) : (
          <div className="record-list">
            {props.pendingActions.map((action) => (
              <article key={action.id} className="record-card">
                <div className="meta-row">
                  <span>{action.toolName}</span>
                  <strong>{new Date(action.createdAt).toLocaleTimeString()}</strong>
                </div>
                <CodeBlock value={action.args} />
                <button type="button" onClick={() => void props.onApprove(action.id)}>
                  Duyệt
                </button>
              </article>
            ))}
          </div>
        )}

        <header className="section-header compact-header audit-title">
          <div>
            <span className="section-kicker">Audit</span>
            <h2>Tool log</h2>
          </div>
        </header>
        {props.toolAuditEntries.length === 0 ? (
          <p className="muted">Chưa có audit entry.</p>
        ) : (
          <div className="record-list">
            {props.toolAuditEntries.slice(0, 8).map((entry) => (
              <details key={entry.id} className="record-card">
                <summary>
                  {entry.toolName} - {entry.status}
                </summary>
                <CodeBlock value={entry} />
              </details>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

interface TelemetryPanelProps {
  costSummary: CostSummary | null;
  costSummaryError: string | null;
  onRefreshCostSummary(): Promise<void>;
}

function TelemetryPanel(props: TelemetryPanelProps) {
  return (
    <section className="sidebar-section">
      <div className="sidebar-title">
        <span>Cost</span>
        <button type="button" className="icon-button" onClick={props.onRefreshCostSummary}>
          ↻
        </button>
      </div>
      {props.costSummary ? (
        <div className="meta-list">
          <div className="meta-row">
            <span>Requests</span>
            <strong>{props.costSummary.request_count}</strong>
          </div>
          <div className="meta-row">
            <span>Tokens</span>
            <strong>{props.costSummary.total_tokens}</strong>
          </div>
          <div className="meta-row">
            <span>USD</span>
            <strong>{formatUsd(props.costSummary.estimated_cost_usd)}</strong>
          </div>
        </div>
      ) : (
        <p className="muted small-text">Cost summary cần conversation persistence.</p>
      )}
      {props.costSummaryError ? <p className="warning small-text">{props.costSummaryError}</p> : null}
    </section>
  );
}

function UsageGrid({ usage }: { usage: UsageView }) {
  return (
    <section className="usage-grid">
      <Metric label="Input" value={usage.inputTokens} />
      <Metric label="Output" value={usage.outputTokens} />
      <Metric label="Thinking" value={usage.thinkingTokens ?? 0} />
      <Metric label="Total" value={usage.totalTokens} />
      <Metric label="Latency" value={`${usage.latencyMs} ms`} />
      <Metric label="Cost" value={formatUsd(usage.estimatedCostUsd ?? 0)} />
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function CodeBlock({ value }: { value: unknown }) {
  return <pre>{typeof value === "string" ? value : JSON.stringify(value, null, 2)}</pre>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatUsd(value: number): string {
  return `$${value.toFixed(6)}`;
}

function loadStoredConversation(): { conversationId?: string; messages: ChatMessage[] } {
  const raw = localStorage.getItem(conversationStorageKey);
  if (!raw) {
    return { messages: [] };
  }

  try {
    const parsed = JSON.parse(raw) as { conversationId?: string; messages?: ChatMessage[] };
    return {
      conversationId: parsed.conversationId,
      messages: Array.isArray(parsed.messages) ? parsed.messages : []
    };
  } catch {
    return { messages: [] };
  }
}
