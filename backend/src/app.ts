import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import { registerAgentRoutes } from "./agent/routes.js";
import { buildConversationPrompt } from "./conversations/context.js";
import type { AppConfig } from "./config.js";
import type { ConversationRepository } from "./conversations/repository.js";
import { registerFileRoutes } from "./filesystem/routes.js";
import { defaultRetryPolicy, retryLlmProviderCall, type RetryPolicy } from "./providers/retry.js";
import type { LlmProvider } from "./providers/types.js";
import { LlmProviderError } from "./providers/types.js";
import {
  extractSupportTicket,
  StructuredOutputError,
  validateSupportTicketRequest
} from "./structured/support-ticket.js";
import { encodeStreamEvent } from "./streaming/events.js";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  userId: z.string().min(1).max(128).default("demo-user")
});

interface BuildAppOptions {
  conversationRepository?: ConversationRepository;
  retryPolicy?: RetryPolicy;
  retrySleep?: (delayMs: number) => Promise<void>;
}

export function buildApp(
  provider: LlmProvider,
  config?: AppConfig,
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({ logger: true });
  const conversationRepository = options.conversationRepository;
  const retryPolicy = options.retryPolicy ??
    (config
      ? {
          maxAttempts: config.LLM_RETRY_MAX_ATTEMPTS,
          baseDelayMs: config.LLM_RETRY_BASE_DELAY_MS,
          maxDelayMs: config.LLM_RETRY_MAX_DELAY_MS,
          jitterRatio: config.LLM_RETRY_JITTER_RATIO
        }
      : defaultRetryPolicy);

  app.get("/health", async () => ({ status: "ok" }));
  if (config) {
    registerFileRoutes(app, config);
    if (config.LLM_PROVIDER === "gemini" && config.GEMINI_API_KEY) {
      registerAgentRoutes(app, config);
    }
  }

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
      const conversation = conversationRepository
        ? parsedRequest.data.conversationId
          ? await conversationRepository.findConversationForUser(
              parsedRequest.data.conversationId,
              parsedRequest.data.userId
            )
          : await conversationRepository.createConversation(parsedRequest.data.userId)
        : null;

      if (conversationRepository && !conversation) {
        return reply.status(404).send({ detail: "Conversation not found" });
      }

      const previousMessages =
        conversationRepository && conversation
          ? await conversationRepository.listMessages(conversation.id)
          : [];

      if (conversationRepository && conversation) {
        await conversationRepository.addMessage({
          conversationId: conversation.id,
          role: "user",
          content: parsedRequest.data.message
        });
      }

      const providerMessage = buildConversationPrompt(previousMessages, parsedRequest.data.message);
      const result = await retryLlmProviderCall(() => provider.generate(providerMessage), {
        ...retryPolicy,
        sleep: options.retrySleep,
        onRetry: ({ attempt, delayMs, error }) => {
          request.log.warn(
            { attempt, nextAttempt: attempt + 1, delayMs, error },
            "Retrying LLM request after retryable provider error"
          );
        }
      });
      const latencyMs = Math.round(performance.now() - startedAt);

      let assistantMessageId: string | undefined;
      if (conversationRepository && conversation) {
        const assistantMessage = await conversationRepository.addMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: result.text,
          model: result.model,
          provider: result.provider,
          usage: result.usage
        });
        assistantMessageId = assistantMessage.id;
      }

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
        latency_ms: latencyMs,
        conversation_id: conversation?.id,
        assistant_message_id: assistantMessageId
      };
    } catch (error) {
      if (error instanceof LlmProviderError) {
        request.log.warn({ error }, "LLM request failed");
        return reply.status(502).send({ detail: error.message });
      }
      throw error;
    }
  });

  app.post("/api/chat/stream", async (request, reply) => {
    const parsedRequest = chatRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid request",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    const abortController = new AbortController();
    reply.raw.on("close", () => abortController.abort());

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });

    const startedAt = performance.now();

    try {
      const conversation = conversationRepository
        ? parsedRequest.data.conversationId
          ? await conversationRepository.findConversationForUser(
              parsedRequest.data.conversationId,
              parsedRequest.data.userId
            )
          : await conversationRepository.createConversation(parsedRequest.data.userId)
        : null;

      if (conversationRepository && !conversation) {
        reply.raw.write(encodeStreamEvent({ type: "error", message: "Conversation not found" }));
        return;
      }

      const previousMessages =
        conversationRepository && conversation
          ? await conversationRepository.listMessages(conversation.id)
          : [];

      if (conversationRepository && conversation) {
        await conversationRepository.addMessage({
          conversationId: conversation.id,
          role: "user",
          content: parsedRequest.data.message
        });
      }

      const providerMessage = buildConversationPrompt(previousMessages, parsedRequest.data.message);
      let assistantText = "";
      let providerName: "fake" | "openai" | "gemini" | null = null;
      let modelName: string | null = null;
      let usage = null as Awaited<ReturnType<LlmProvider["generate"]>>["usage"] | null;

      for await (const event of provider.stream(providerMessage, {
        signal: abortController.signal
      })) {
        request.log.info({ event }, "Streaming event received");
        if (abortController.signal.aborted) {
          break;
        }

        if (event.type === "metadata") {
          providerName = event.provider;
          modelName = event.model;
          reply.raw.write(
            encodeStreamEvent({
              type: "start",
              provider: event.provider,
              model: event.model,
              conversationId: conversation?.id
            })
          );
        }

        if (event.type === "delta") {
          assistantText += event.text;
          reply.raw.write(encodeStreamEvent({ type: "delta", text: event.text }));
        }

        if (event.type === "usage") {
          usage = event.usage;
          reply.raw.write(
            encodeStreamEvent({
              type: "usage",
              usage: event.usage,
              latencyMs: Math.round(performance.now() - startedAt)
            })
          );
        }
      }

      if (!abortController.signal.aborted) {
        if (conversationRepository && conversation && assistantText && providerName && modelName && usage) {
          await conversationRepository.addMessage({
            conversationId: conversation.id,
            role: "assistant",
            content: assistantText,
            provider: providerName,
            model: modelName,
            usage
          });
        }
        reply.raw.write(encodeStreamEvent({ type: "end" }));
      }
    } catch (error) {
      const message =
        error instanceof LlmProviderError ? error.message : "Unexpected streaming failure";
      reply.raw.write(encodeStreamEvent({ type: "error", message }));
    } finally {
      reply.raw.end();
    }
  });

  app.post("/api/structured/support-ticket", async (request, reply) => {
    const parsedRequest = chatRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid request",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    try {
      const requestBody = validateSupportTicketRequest(request.body);
      return await extractSupportTicket(provider, requestBody.message);
    } catch (error) {
      if (error instanceof StructuredOutputError) {
        request.log.warn({ error }, "Structured output validation failed");
        return reply.status(422).send({
          detail: error.message,
          errors: error.details
        });
      }

      if (error instanceof LlmProviderError) {
        request.log.warn({ error }, "LLM request failed");
        return reply.status(502).send({ detail: error.message });
      }

      throw error;
    }
  });

  return app;
}
