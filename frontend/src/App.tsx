import { FormEvent, useEffect, useRef, useState } from "react";

import {
  approvePendingAction,
  chatWithFileAgent,
  listPendingActions,
  listToolAudit,
  type AgentChatResponse,
  type PendingAction,
  type ToolAuditEntry
} from "./api/file-agent";
import { streamChat } from "./api/chat-stream";
import type { StreamEvent } from "./lib/stream-events";
import "./styles.css";

interface UsageView {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
  totalTokens: number;
  latencyMs: number;
}

type StreamStatus = "idle" | "streaming" | "done" | "error" | "stopped";
type AgentStatus = "idle" | "loading" | "done" | "error";

export default function App() {
  const [activeMode, setActiveMode] = useState<"streaming" | "agent">("streaming");
  const [message, setMessage] = useState("Giai thich HTTP streaming trong 2 cau ngan.");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<{ provider: string; model: string } | null>(null);
  const [usage, setUsage] = useState<UsageView | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | null>(null);

  const [agentMessage, setAgentMessage] = useState(
    "Hay tao file notes/ai-test.txt voi noi dung: hello from file agent"
  );
  const [agentStatus, setAgentStatus] = useState<AgentStatus>("idle");
  const [agentResult, setAgentResult] = useState<AgentChatResponse | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [toolAuditEntries, setToolAuditEntries] = useState<ToolAuditEntry[]>([]);
  const [approvalResult, setApprovalResult] = useState<unknown>(null);

  useEffect(() => {
    void refreshPendingActions();
    void refreshToolAudit();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage || status === "streaming") {
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setAnswer("");
    setUsage(null);
    setMetadata(null);
    setError(null);
    setStatus("streaming");

    try {
      await streamChat({
        message: trimmedMessage,
        conversationId,
        signal: abortController.signal,
        onEvent: handleStreamEvent
      });

      if (!abortController.signal.aborted) {
        setStatus("done");
      }
    } catch (streamError) {
      if (abortController.signal.aborted) {
        setStatus("stopped");
        return;
      }

      setError(streamError instanceof Error ? streamError.message : "Unknown streaming error");
      setStatus("error");
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleStreamEvent(event: StreamEvent) {
    if (event.type === "start") {
      setMetadata({ provider: event.provider, model: event.model });
      if (event.conversationId) {
        setConversationId(event.conversationId);
      }
    }

    if (event.type === "delta") {
      setAnswer((current) => current + event.text);
    }

    if (event.type === "usage") {
      setUsage({
        inputTokens: event.usage.inputTokens,
        outputTokens: event.usage.outputTokens,
        thinkingTokens: event.usage.thinkingTokens,
        totalTokens: event.usage.totalTokens,
        latencyMs: event.latencyMs
      });
    }

    if (event.type === "error") {
      setError(event.message);
      setStatus("error");
    }
  }

  function stopGenerating() {
    abortControllerRef.current?.abort();
    setStatus("stopped");
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
        agentRequestError instanceof Error ? agentRequestError.message : "Unknown agent error"
      );
      setAgentStatus("error");
    }
  }

  async function refreshPendingActions() {
    try {
      setPendingActions(await listPendingActions());
    } catch (pendingError) {
      setAgentError(pendingError instanceof Error ? pendingError.message : "Cannot load actions");
    }
  }

  async function refreshToolAudit() {
    try {
      setToolAuditEntries(await listToolAudit());
    } catch (auditError) {
      setAgentError(auditError instanceof Error ? auditError.message : "Cannot load audit log");
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
      setAgentError(approvalError instanceof Error ? approvalError.message : "Approval failed");
    }
  }

  return (
    <main className="page">
      <section className="panel">
        <div className="eyebrow">AI Integration - Week 3</div>
        <h1>AI Chat Lab</h1>
        <p className="description">
          Streaming chat for latency practice, plus a file agent UI for tool calling. In auto-apply
          mode, write/delete tools run immediately inside the configured allowed roots.
        </p>

        <div className="tabs" role="tablist" aria-label="AI lab modes">
          <button
            type="button"
            className={activeMode === "streaming" ? "tab active" : "tab"}
            onClick={() => setActiveMode("streaming")}
          >
            Streaming Chat
          </button>
          <button
            type="button"
            className={activeMode === "agent" ? "tab active" : "tab"}
            onClick={() => setActiveMode("agent")}
          >
            File Agent
          </button>
        </div>

        {activeMode === "streaming" ? (
          <StreamingChatView
            answer={answer}
            error={error}
            handleSubmit={handleSubmit}
            message={message}
            metadata={metadata}
            setMessage={setMessage}
            status={status}
            stopGenerating={stopGenerating}
            usage={usage}
            conversationId={conversationId}
          />
        ) : (
          <FileAgentView
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
        )}
      </section>
    </main>
  );
}

interface StreamingChatViewProps {
  answer: string;
  error: string | null;
  handleSubmit(event: FormEvent<HTMLFormElement>): void;
  message: string;
  metadata: { provider: string; model: string } | null;
  setMessage(message: string): void;
  status: StreamStatus;
  stopGenerating(): void;
  usage: UsageView | null;
  conversationId?: string;
}

function StreamingChatView(props: StreamingChatViewProps) {
  return (
    <>
      <form onSubmit={props.handleSubmit} className="chat-form">
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          value={props.message}
          onChange={(event) => props.setMessage(event.target.value)}
          disabled={props.status === "streaming"}
          rows={4}
        />
        <div className="actions">
          <button type="submit" disabled={props.status === "streaming" || !props.message.trim()}>
            Send
          </button>
          <button type="button" onClick={props.stopGenerating} disabled={props.status !== "streaming"}>
            Stop generating
          </button>
        </div>
      </form>

      <section className="answer-card" aria-live="polite">
        <div className="answer-header">
          <span>Status: {props.status}</span>
          {props.conversationId ? <span>Conversation: {props.conversationId.slice(0, 8)}</span> : null}
          {props.metadata ? (
            <span>
              {props.metadata.provider} / {props.metadata.model}
            </span>
          ) : null}
        </div>
        {props.answer ? (
          <p className="answer">{props.answer}</p>
        ) : (
          <p className="muted">No response yet.</p>
        )}
        {props.error ? <p className="error">Error: {props.error}</p> : null}
      </section>

      {props.usage ? (
        <section className="usage-grid">
          <Metric label="Input" value={props.usage.inputTokens} />
          <Metric label="Output" value={props.usage.outputTokens} />
          <Metric label="Thinking" value={props.usage.thinkingTokens ?? 0} />
          <Metric label="Total" value={props.usage.totalTokens} />
          <Metric label="Latency" value={`${props.usage.latencyMs} ms`} />
        </section>
      ) : null}
    </>
  );
}

interface FileAgentViewProps {
  agentError: string | null;
  agentMessage: string;
  agentResult: AgentChatResponse | null;
  agentStatus: AgentStatus;
  approvalResult: unknown;
  onApprove(actionId: string): Promise<void>;
  onRefreshAudit(): Promise<void>;
  onRefreshPending(): Promise<void>;
  onSubmit(event: FormEvent<HTMLFormElement>): void;
  pendingActions: PendingAction[];
  setAgentMessage(message: string): void;
  toolAuditEntries: ToolAuditEntry[];
}

function FileAgentView(props: FileAgentViewProps) {
  return (
    <section className="agent-layout">
      <div>
        <form onSubmit={props.onSubmit} className="chat-form">
          <label htmlFor="agent-message">Agent message</label>
          <textarea
            id="agent-message"
            value={props.agentMessage}
            onChange={(event) => props.setAgentMessage(event.target.value)}
            disabled={props.agentStatus === "loading"}
            rows={5}
          />
          <div className="actions">
            <button
              type="submit"
              disabled={props.agentStatus === "loading" || !props.agentMessage.trim()}
            >
              Run agent
            </button>
            <button type="button" className="secondary-button" onClick={props.onRefreshPending}>
              Refresh pending
            </button>
          </div>
        </form>

        <section className="answer-card" aria-live="polite">
          <div className="answer-header">
            <span>Status: {props.agentStatus}</span>
            <span>Gemini tools</span>
          </div>
          {props.agentResult ? (
            <>
              <p className="answer">{props.agentResult.answer || "No text answer."}</p>
              {props.agentResult.approvalRequired ? (
                <p className="warning">
                  Approval required: {props.agentResult.approvalRequired.toolName}{" "}
                  {props.agentResult.approvalRequired.id}
                </p>
              ) : null}
              {props.agentResult.executedActions?.length ? (
                <p className="success">
                  Executed {props.agentResult.executedActions.length} write/delete action(s).
                </p>
              ) : null}
            </>
          ) : (
            <p className="muted">Ask the agent to list, read, search, write, or delete files.</p>
          )}
          {props.agentError ? <p className="error">Error: {props.agentError}</p> : null}
        </section>

        {props.agentResult?.toolCalls.length ? (
          <section className="tool-call-list">
            <h2>Tool calls</h2>
            {props.agentResult.toolCalls.map((toolCall, index) => (
              <details key={`${toolCall.name}-${index}`} className="tool-call" open>
                <summary>{toolCall.name}</summary>
                <CodeBlock value={{ args: toolCall.args, result: toolCall.result }} />
              </details>
            ))}
          </section>
        ) : null}

        {props.agentResult?.executedActions?.length ? (
          <section className="tool-call-list">
            <h2>Executed actions</h2>
            {props.agentResult.executedActions.map((action, index) => (
              <details key={`${action.toolName}-${action.executedAt}-${index}`} className="tool-call" open>
                <summary>
                  {action.toolName} at {new Date(action.executedAt).toLocaleString()}
                </summary>
                <CodeBlock value={{ args: action.args, result: action.result }} />
              </details>
            ))}
          </section>
        ) : null}

        {props.approvalResult !== null ? (
          <section className="tool-call-list">
            <h2>Last approval result</h2>
            <CodeBlock value={props.approvalResult} />
          </section>
        ) : null}
      </div>

      <aside className="pending-panel">
        <div className="pending-header">
          <h2>Pending actions</h2>
          <button type="button" className="secondary-button compact" onClick={props.onRefreshPending}>
            Refresh
          </button>
        </div>
        <p className="muted">
          Auto-apply is enabled in this learning setup, so write/delete actions should execute
          immediately. This panel is only used if auto-apply is disabled later.
        </p>
        {props.pendingActions.length === 0 ? (
          <p className="muted">No pending actions.</p>
        ) : (
          <div className="pending-list">
            {props.pendingActions.map((action) => (
              <article key={action.id} className="pending-card">
                <div className="pending-meta">
                  <strong>{action.toolName}</strong>
                  <span>{new Date(action.createdAt).toLocaleString()}</span>
                </div>
                <CodeBlock value={action.args} />
                <button type="button" onClick={() => void props.onApprove(action.id)}>
                  Approve
                </button>
              </article>
            ))}
          </div>
        )}

        <div className="pending-header audit-header">
          <h2>Tool audit</h2>
          <button type="button" className="secondary-button compact" onClick={props.onRefreshAudit}>
            Refresh
          </button>
        </div>
        {props.toolAuditEntries.length === 0 ? (
          <p className="muted">No audited tool calls yet.</p>
        ) : (
          <div className="pending-list">
            {props.toolAuditEntries.slice(0, 8).map((entry) => (
              <details key={entry.id} className="pending-card" open>
                <summary>
                  {entry.toolName} - {entry.status}
                </summary>
                <CodeBlock value={entry} />
              </details>
            ))}
          </div>
        )}
      </aside>
    </section>
  );
}

function CodeBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function Metric({ label, value }: { label: number | string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
