import type { LlmProvider, LlmResult } from "./types.js";

function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}

export class FakeLlmProvider implements LlmProvider {
  async generate(message: string): Promise<LlmResult> {
    const text = message.includes("Extract a support ticket from the user message.")
      ? JSON.stringify({
          title: "Demo support ticket",
          category: inferCategory(message),
          priority: message.toLowerCase().includes("gấp") ? "high" : "medium",
          customerEmail: inferEmail(message),
          summary: "Phiên bản fake provider đã trích xuất ticket hợp lệ để kiểm thử UI.",
          needsHumanReview: /payment|billing|hóa đơn|security|cancel|angry|gấp/iu.test(message)
        })
      : `Fake LLM response: ${message}`;
    const inputTokens = countWords(message);
    const outputTokens = countWords(text);

    return {
      text,
      provider: "fake",
      model: "fake-learning-model",
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens
      }
    };
  }

  async *stream(message: string, options?: { signal?: AbortSignal }) {
    const result = await this.generate(message);
    yield { type: "metadata" as const, provider: result.provider, model: result.model };

    for (const part of result.text.split(/(\s+)/u).filter(Boolean)) {
      if (options?.signal?.aborted) {
        return;
      }
      yield { type: "delta" as const, text: part };
    }

    yield { type: "usage" as const, usage: result.usage };
  }
}

function inferEmail(message: string): string | null {
  return message.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/u)?.[0] ?? null;
}

function inferCategory(message: string): "billing" | "technical" | "account" | "general" {
  if (/invoice|billing|payment|refund|hóa đơn|thanh toán/iu.test(message)) {
    return "billing";
  }
  if (/password|login|account|tài khoản/iu.test(message)) {
    return "account";
  }
  if (/bug|error|crash|lỗi|không tải/iu.test(message)) {
    return "technical";
  }
  return "general";
}
