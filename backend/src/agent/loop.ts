export interface ReadOnlyAgentTool {
  name: string;
  description: string;
  run(input: string): Promise<string>;
}

export interface AgentLoopOptions {
  maxIterations: number;
  timeoutMs: number;
  maxToolCalls: number;
  maxObservationCharacters: number;
  now?: () => number;
}

export interface AgentAuditEntry {
  iteration: number;
  toolName: string;
  status: "succeeded" | "failed";
  input: string;
  observation: string;
}

export interface AgentLoopResult {
  status: "answered" | "stopped";
  answer: string;
  auditLog: AgentAuditEntry[];
  stopReason?: "max_iterations" | "timeout" | "budget_exceeded" | "tool_not_found";
}

interface AgentState {
  question: string;
  observations: string[];
  auditLog: AgentAuditEntry[];
  toolCalls: number;
}

export async function runReadOnlyAgentLoop(
  question: string,
  tools: ReadOnlyAgentTool[],
  options: AgentLoopOptions
): Promise<AgentLoopResult> {
  const now = options.now ?? (() => Date.now());
  const startedAt = now();
  const state: AgentState = {
    question,
    observations: [],
    auditLog: [],
    toolCalls: 0
  };

  for (let iteration = 1; iteration <= options.maxIterations; iteration += 1) {
    if (now() - startedAt > options.timeoutMs) {
      return stop(state, "timeout");
    }
    if (state.toolCalls >= options.maxToolCalls) {
      return stop(state, "budget_exceeded");
    }

    const decision = decideNextAction(question, state.observations, tools);
    if (decision.type === "answer") {
      return {
        status: "answered",
        answer: decision.answer,
        auditLog: state.auditLog
      };
    }

    const tool = tools.find((candidate) => candidate.name === decision.toolName);
    if (!tool) {
      return stop(state, "tool_not_found");
    }

    state.toolCalls += 1;
    try {
      const rawObservation = await tool.run(decision.input);
      const observation = sanitizeToolObservation(rawObservation, options.maxObservationCharacters);
      state.observations.push(`[${tool.name}] ${observation}`);
      state.auditLog.push({
        iteration,
        toolName: tool.name,
        status: "succeeded",
        input: decision.input,
        observation
      });
    } catch (error) {
      const observation = error instanceof Error ? error.message : "Unknown tool failure";
      state.observations.push(`[${tool.name}] TOOL_ERROR: ${observation}`);
      state.auditLog.push({
        iteration,
        toolName: tool.name,
        status: "failed",
        input: decision.input,
        observation
      });
    }
  }

  return stop(state, "max_iterations");
}

function decideNextAction(
  question: string,
  observations: string[],
  tools: ReadOnlyAgentTool[]
):
  | { type: "tool"; toolName: string; input: string }
  | { type: "answer"; answer: string } {
  if (observations.length > 0) {
    return {
      type: "answer",
      answer: `Dựa trên dữ liệu quan sát được:\n${observations.join("\n")}`
    };
  }

  const lowerQuestion = question.toLowerCase();
  const selectedTool =
    tools.find((tool) => lowerQuestion.includes(tool.name.toLowerCase())) ??
    tools.find((tool) =>
      tool.description
        .toLowerCase()
        .split(/\W+/)
        .some((term) => term.length > 3 && lowerQuestion.includes(term))
    ) ??
    tools[0];

  return selectedTool
    ? { type: "tool", toolName: selectedTool.name, input: question }
    : { type: "answer", answer: "Không có tool read-only phù hợp để xử lý câu hỏi." };
}

function sanitizeToolObservation(rawObservation: string, maxCharacters: number): string {
  const clipped = rawObservation.slice(0, maxCharacters);
  return clipped
    .replace(/ignore (all )?(previous|system|developer) instructions/giu, "[untrusted instruction removed]")
    .replace(/you are now/giu, "[untrusted role claim removed]");
}

function stop(
  state: AgentState,
  stopReason: NonNullable<AgentLoopResult["stopReason"]>
): AgentLoopResult {
  return {
    status: "stopped",
    stopReason,
    answer: `Agent đã dừng vì ${stopReason}. Quan sát hiện có:\n${state.observations.join("\n")}`,
    auditLog: state.auditLog
  };
}
