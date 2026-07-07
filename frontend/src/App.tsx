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
import {
  evaluateRag,
  queryRag,
  uploadRagDocument,
  type RagEvaluationResult,
  type RagQueryResult,
  type RagUploadResult,
  type RetrievalStrategy
} from "./api/rag";
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

type AppView = "chat" | "structured" | "tools" | "rag";
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

  const [ragTenantId, setRagTenantId] = useState("tenant_demo");
  const [ragOwnerUserId, setRagOwnerUserId] = useState("user_demo");
  const [ragTitle, setRagTitle] = useState("Secure RAG notes");
  const [ragSourceUri, setRagSourceUri] = useState("memory://secure-rag-notes.txt");
  const [ragFile, setRagFile] = useState<File | null>(null);
  const [ragUploadStatus, setRagUploadStatus] = useState<RequestStatus>("idle");
  const [ragUploadResult, setRagUploadResult] = useState<RagUploadResult | null>(null);
  const [ragError, setRagError] = useState<string | null>(null);
  const [ragQuestion, setRagQuestion] = useState("Tài liệu nói gì về citation?");
  const [ragStrategy, setRagStrategy] = useState<RetrievalStrategy>("hybrid");
  const [ragTopK, setRagTopK] = useState(3);
  const [ragThreshold, setRagThreshold] = useState(0.05);
  const [ragQueryStatus, setRagQueryStatus] = useState<RequestStatus>("idle");
  const [ragQueryResult, setRagQueryResult] = useState<RagQueryResult | null>(null);
  const [ragExpectedText, setRagExpectedText] = useState("citation");
  const [ragExpectedPage, setRagExpectedPage] = useState(1);
  const [ragEvaluationStatus, setRagEvaluationStatus] = useState<RequestStatus>("idle");
  const [ragEvaluationResult, setRagEvaluationResult] = useState<RagEvaluationResult | null>(null);

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

  async function handleRagUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ragFile || ragUploadStatus === "loading") {
      return;
    }

    setRagError(null);
    setRagUploadStatus("loading");
    setRagUploadResult(null);
    setRagQueryResult(null);
    setRagEvaluationResult(null);

    try {
      const uploadContent = await readRagFile(ragFile);
      const result = await uploadRagDocument({
        tenantId: ragTenantId,
        ownerUserId: ragOwnerUserId,
        title: ragTitle,
        sourceUri: ragSourceUri || `memory://${ragFile.name}`,
        fileName: ragFile.name,
        mimeType: uploadContent.mimeType,
        contentEncoding: uploadContent.contentEncoding,
        content: uploadContent.content
      });
      setRagUploadResult(result);
      setRagUploadStatus("done");
    } catch (uploadError) {
      setRagError(uploadError instanceof Error ? uploadError.message : "Upload RAG thất bại");
      setRagUploadStatus("error");
    }
  }

  async function handleRagQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuestion = ragQuestion.trim();
    if (!trimmedQuestion || ragQueryStatus === "loading") {
      return;
    }

    setRagError(null);
    setRagQueryStatus("loading");
    setRagQueryResult(null);

    try {
      setRagQueryResult(
        await queryRag({
          tenantId: ragTenantId,
          ownerUserId: ragOwnerUserId,
          query: trimmedQuestion,
          strategy: ragStrategy,
          topK: ragTopK,
          similarityThreshold: ragThreshold
        })
      );
      setRagQueryStatus("done");
    } catch (queryError) {
      setRagError(queryError instanceof Error ? queryError.message : "RAG query thất bại");
      setRagQueryStatus("error");
    }
  }

  async function handleRagEvaluate() {
    if (!ragUploadResult || ragEvaluationStatus === "loading") {
      return;
    }

    setRagError(null);
    setRagEvaluationStatus("loading");
    setRagEvaluationResult(null);

    try {
      setRagEvaluationResult(
        await evaluateRag({
          tenantId: ragTenantId,
          ownerUserId: ragOwnerUserId,
          strategy: ragStrategy,
          topK: ragTopK,
          similarityThreshold: ragThreshold,
          cases: [
            {
              id: "ui_case_1",
              question: ragQuestion,
              expectedAnswerContains: ragExpectedText
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
              expectedDocumentId: ragUploadResult.document_id,
              expectedPageNumber: ragExpectedPage
            }
          ]
        })
      );
      setRagEvaluationStatus("done");
    } catch (evaluationError) {
      setRagError(
        evaluationError instanceof Error ? evaluationError.message : "RAG evaluation thất bại"
      );
      setRagEvaluationStatus("error");
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
          <button
            type="button"
            className={activeView === "rag" ? "nav-tab active" : "nav-tab"}
            onClick={() => setActiveView("rag")}
          >
            RAG
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

        {activeView === "rag" ? (
          <RagWorkspace
            error={ragError}
            evaluationResult={ragEvaluationResult}
            evaluationStatus={ragEvaluationStatus}
            expectedPage={ragExpectedPage}
            expectedText={ragExpectedText}
            file={ragFile}
            onEvaluate={handleRagEvaluate}
            onQuery={handleRagQuery}
            onUpload={handleRagUpload}
            ownerUserId={ragOwnerUserId}
            queryResult={ragQueryResult}
            queryStatus={ragQueryStatus}
            question={ragQuestion}
            setExpectedPage={setRagExpectedPage}
            setExpectedText={setRagExpectedText}
            setFile={setRagFile}
            setOwnerUserId={setRagOwnerUserId}
            setQuestion={setRagQuestion}
            setSourceUri={setRagSourceUri}
            setStrategy={setRagStrategy}
            setTenantId={setRagTenantId}
            setThreshold={setRagThreshold}
            setTitle={setRagTitle}
            setTopK={setRagTopK}
            sourceUri={ragSourceUri}
            strategy={ragStrategy}
            tenantId={ragTenantId}
            threshold={ragThreshold}
            title={ragTitle}
            topK={ragTopK}
            uploadResult={ragUploadResult}
            uploadStatus={ragUploadStatus}
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

interface RagWorkspaceProps {
  error: string | null;
  evaluationResult: RagEvaluationResult | null;
  evaluationStatus: RequestStatus;
  expectedPage: number;
  expectedText: string;
  file: File | null;
  onEvaluate(): Promise<void>;
  onQuery(event: FormEvent<HTMLFormElement>): void;
  onUpload(event: FormEvent<HTMLFormElement>): void;
  ownerUserId: string;
  queryResult: RagQueryResult | null;
  queryStatus: RequestStatus;
  question: string;
  setExpectedPage(value: number): void;
  setExpectedText(value: string): void;
  setFile(value: File | null): void;
  setOwnerUserId(value: string): void;
  setQuestion(value: string): void;
  setSourceUri(value: string): void;
  setStrategy(value: RetrievalStrategy): void;
  setTenantId(value: string): void;
  setThreshold(value: number): void;
  setTitle(value: string): void;
  setTopK(value: number): void;
  sourceUri: string;
  strategy: RetrievalStrategy;
  tenantId: string;
  threshold: number;
  title: string;
  topK: number;
  uploadResult: RagUploadResult | null;
  uploadStatus: RequestStatus;
}

function RagWorkspace(props: RagWorkspaceProps) {
  return (
    <div className="workspace-grid">
      <section className="chat-panel">
        <header className="section-header">
          <div>
            <span className="section-kicker">Project 2</span>
            <h2>Secure RAG PDF Assistant</h2>
          </div>
          <StatusPill status={props.queryStatus === "idle" ? props.uploadStatus : props.queryStatus} />
        </header>

        <form onSubmit={props.onUpload} className="rag-upload-grid">
          <label>
            Tenant
            <input value={props.tenantId} onChange={(event) => props.setTenantId(event.target.value)} />
          </label>
          <label>
            Owner
            <input
              value={props.ownerUserId}
              onChange={(event) => props.setOwnerUserId(event.target.value)}
            />
          </label>
          <label>
            Title
            <input value={props.title} onChange={(event) => props.setTitle(event.target.value)} />
          </label>
          <label>
            Source URI
            <input
              value={props.sourceUri}
              onChange={(event) => props.setSourceUri(event.target.value)}
            />
          </label>
          <label className="wide-field">
            Document
            <input
              type="file"
              accept=".txt,.md,.pdf,text/plain,application/pdf"
              onChange={(event) => props.setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="actions wide-field">
            <button type="submit" disabled={!props.file || props.uploadStatus === "loading"}>
              Upload & ingest
            </button>
          </div>
        </form>

        {props.uploadResult ? (
          <section className="usage-grid">
            <Metric label="Document" value={props.uploadResult.document_id.slice(0, 8)} />
            <Metric label="Status" value={props.uploadResult.status} />
            <Metric label="Pages" value={props.uploadResult.page_count} />
            <Metric label="Chunks" value={props.uploadResult.chunk_count} />
            <Metric label="Version" value={props.uploadResult.version} />
            <Metric label="Batches" value={props.uploadResult.embedding_batch_count} />
          </section>
        ) : null}

        <form onSubmit={props.onQuery} className="composer top-composer rag-query-form">
          <label>
            Câu hỏi cho tài liệu
            <textarea
              value={props.question}
              onChange={(event) => props.setQuestion(event.target.value)}
              rows={3}
            />
          </label>
          <div className="rag-controls">
            <label>
              Strategy
              <select
                value={props.strategy}
                onChange={(event) => props.setStrategy(event.target.value as RetrievalStrategy)}
              >
                <option value="hybrid">hybrid</option>
                <option value="semantic">semantic</option>
                <option value="keyword">keyword</option>
              </select>
            </label>
            <label>
              Top K
              <input
                type="number"
                min={1}
                max={10}
                value={props.topK}
                onChange={(event) => props.setTopK(Number(event.target.value))}
              />
            </label>
            <label>
              Threshold
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={props.threshold}
                onChange={(event) => props.setThreshold(Number(event.target.value))}
              />
            </label>
          </div>
          <div className="actions">
            <button type="submit" disabled={props.queryStatus === "loading" || !props.question.trim()}>
              Hỏi tài liệu
            </button>
          </div>
        </form>

        {props.error ? <p className="error banner">Error: {props.error}</p> : null}

        {props.queryResult ? (
          <section className="answer-card">
            <div className="message-meta">
              <span>{props.queryResult.status}</span>
              <span>{props.queryResult.citations.length} citations</span>
            </div>
            <p className="answer">{props.queryResult.answer}</p>
          </section>
        ) : (
          <div className="empty-state">Upload tài liệu rồi hỏi để xem câu trả lời có citation.</div>
        )}

        {props.queryResult?.contexts.length ? (
          <section className="record-list">
            <h3>Retrieved contexts</h3>
            {props.queryResult.contexts.map((context) => (
              <details key={context.chunkId} className="record-card" open>
                <summary>
                  page {context.citation.pageNumber ?? "?"} - score {context.score.toFixed(3)}
                </summary>
                <p>{context.content}</p>
                <CodeBlock value={context.citation} />
              </details>
            ))}
          </section>
        ) : null}
      </section>

      <aside className="detail-panel tall-panel">
        <header className="section-header compact-header">
          <div>
            <span className="section-kicker">Evaluation</span>
            <h2>Test case</h2>
          </div>
          <StatusPill status={props.evaluationStatus} />
        </header>
        <div className="record-list">
          <label>
            Expected contains
            <input
              value={props.expectedText}
              onChange={(event) => props.setExpectedText(event.target.value)}
            />
          </label>
          <label>
            Expected page
            <input
              type="number"
              min={1}
              value={props.expectedPage}
              onChange={(event) => props.setExpectedPage(Number(event.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={() => void props.onEvaluate()}
            disabled={!props.uploadResult || props.evaluationStatus === "loading"}
          >
            Chạy evaluation
          </button>
        </div>
        {props.evaluationResult ? (
          <>
            <section className="usage-grid single-column-grid">
              <Metric label="Cases" value={props.evaluationResult.caseCount} />
              <Metric label="Recall" value={formatPercent(props.evaluationResult.retrievalRecall)} />
              <Metric label="Answer" value={formatPercent(props.evaluationResult.answerCorrectness)} />
              <Metric
                label="Citation"
                value={formatPercent(props.evaluationResult.citationCorrectness)}
              />
            </section>
            <CodeBlock value={props.evaluationResult.report} />
          </>
        ) : (
          <p className="muted">Evaluation report sẽ xuất hiện sau khi có document id từ upload.</p>
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

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

async function readRagFile(file: File): Promise<{
  mimeType: "text/plain" | "application/pdf";
  contentEncoding: "utf8" | "base64";
  content: string;
}> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return {
      mimeType: "application/pdf",
      contentEncoding: "base64",
      content: await readFileAsBase64(file)
    };
  }

  return {
    mimeType: "text/plain",
    contentEncoding: "utf8",
    content: await file.text()
  };
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.includes(",") ? result.split(",").at(-1) ?? "" : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được file"));
    reader.readAsDataURL(file);
  });
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
