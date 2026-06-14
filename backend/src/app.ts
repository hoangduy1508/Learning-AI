import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import type { LlmProvider } from "./providers/types.js";
import { LlmProviderError } from "./providers/types.js";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10_000)
});

export function buildApp(provider: LlmProvider): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.post("/api/chat", async (request, reply) => {
    const parsedRequest = chatRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid request",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    const startedAt = performance.now();
    try {
      const result = await provider.generate(parsedRequest.data.message);
      const latencyMs = Math.round(performance.now() - startedAt);

      request.log.info(
        {
          model: result.model,
          provider: result.provider,
          latencyMs,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          thinkingTokens: result.usage.thinkingTokens ?? 0,
          totalTokens: result.usage.totalTokens
        },
        "LLM request completed"
      );

      return {
        answer: result.text,
        provider: result.provider,
        model: result.model,
        usage: {
          input_tokens: result.usage.inputTokens,
          output_tokens: result.usage.outputTokens,
          thinking_tokens: result.usage.thinkingTokens ?? 0,
          total_tokens: result.usage.totalTokens
        },
        latency_ms: latencyMs
      };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        request.log.warn({ error }, "LLM request failed");
        return reply.status(502).send({ detail: error.message });
      }
      throw error;
    }
  });

  return app;
}
