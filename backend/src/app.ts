import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";

import { registerAgentRoutes } from "./agent/routes.js";
import { buildConversationPrompt } from "./conversations/context.js";
import {
  estimateCostUsdMicros,
  usdMicrosToUsd,
  type ProviderPricingCatalog
} from "./cost.js";
import type { AppConfig } from "./config.js";
import type { ConversationRepository } from "./conversations/repository.js";
import { registerFileRoutes } from "./filesystem/routes.js";
import { InMemoryIngestionJobStore } from "./ingestion/jobs.js";
import { IngestionPipeline } from "./ingestion/pipeline.js";
import { validateIngestionUpload } from "./ingestion/upload.js";
import { InMemoryIngestionVersionStore } from "./ingestion/versioning.js";
import { defaultRetryPolicy, retryLlmProviderCall, type RetryPolicy } from "./providers/retry.js";
import type { LlmProvider } from "./providers/types.js";
import { LlmProviderError } from "./providers/types.js";
import {
  buildEvaluationReport,
  evaluateRagPipeline,
  type RagEvaluationCase
} from "./rag/evaluation.js";
import { RagRetrievalPipeline } from "./rag/retrieval.js";
import { InMemoryRateLimiter, type RateLimitDecision, type RateLimitPolicy } from "./rate-limit.js";
import {
  extractSupportTicket,
  StructuredOutputError,
  validateSupportTicketRequest
} from "./structured/support-ticket.js";
import { encodeStreamEvent } from "./streaming/events.js";
import { InMemoryVectorRepository } from "./vector/repository.js";

const chatRequestSchema = z.object({
  message: z.string().min(1).max(10_000),
  conversationId: z.string().uuid().optional(),
  userId: z.string().min(1).max(128).default("demo-user")
});

const userParamsSchema = z.object({
  userId: z.string().min(1).max(128)
});

const ragQuerySchema = z.object({
  tenantId: z.string().min(1).max(128),
  ownerUserId: z.string().min(1).max(128),
  query: z.string().min(1).max(5_000),
  topK: z.coerce.number().int().min(1).max(10).default(3),
  similarityThreshold: z.coerce.number().min(0).max(1).default(0.05),
  strategy: z.enum(["semantic", "keyword", "hybrid"]).default("hybrid"),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
});

const ragEvaluationSchema = z.object({
  tenantId: z.string().min(1).max(128),
  ownerUserId: z.string().min(1).max(128),
  strategy: z.enum(["semantic", "keyword", "hybrid"]).default("hybrid"),
  topK: z.coerce.number().int().min(1).max(10).default(3),
  similarityThreshold: z.coerce.number().min(0).max(1).default(0.05),
  cases: z
    .array(
      z.object({
        id: z.string().min(1).max(128),
        question: z.string().min(1).max(5_000),
        expectedAnswerContains: z.array(z.string().min(1)).min(1),
        expectedDocumentId: z.string().min(1),
        expectedPageNumber: z.coerce.number().int().positive(),
        metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()
      })
    )
    .min(1)
    .max(50)
});

interface BuildAppOptions {
  conversationRepository?: ConversationRepository;
  rateLimiter?: InMemoryRateLimiter;
  rateLimitPolicy?: RateLimitPolicy;
  retryPolicy?: RetryPolicy;
  retrySleep?: (delayMs: number) => Promise<void>;
  ingestionPipeline?: IngestionPipeline;
}

export function buildApp(
  provider: LlmProvider,
  config?: AppConfig,
  options: BuildAppOptions = {}
): FastifyInstance {
  const app = Fastify({ logger: true });
  const conversationRepository = options.conversationRepository;
  const pricingCatalog = config ? buildPricingCatalog(config) : buildZeroPricingCatalog();
  const rateLimiter =
    options.rateLimiter ??
    new InMemoryRateLimiter(
      options.rateLimitPolicy ??
        (config
          ? {
              maxRequests: config.CHAT_RATE_LIMIT_MAX_REQUESTS,
              windowMs: config.CHAT_RATE_LIMIT_WINDOW_MS
            }
          : { maxRequests: 20, windowMs: 60_000 })
    );
  const retryPolicy = options.retryPolicy ??
    (config
      ? {
          maxAttempts: config.LLM_RETRY_MAX_ATTEMPTS,
          baseDelayMs: config.LLM_RETRY_BASE_DELAY_MS,
          maxDelayMs: config.LLM_RETRY_MAX_DELAY_MS,
          jitterRatio: config.LLM_RETRY_JITTER_RATIO
        }
      : defaultRetryPolicy);
  const vectorRepository = new InMemoryVectorRepository();
  const ingestionPipeline =
    options.ingestionPipeline ??
    new IngestionPipeline(vectorRepository, {
      embeddingDimension: 32,
      embeddingBatchSize: 16,
      chunking: { maxCharacters: 1_000, overlapCharacters: 120 },
      jobStore: new InMemoryIngestionJobStore(),
      versionStore: new InMemoryIngestionVersionStore()
    });
  const ragPipeline = new RagRetrievalPipeline(vectorRepository, { embeddingDimension: 32 });
  const ingestionMaxFileBytes = config?.INGESTION_MAX_FILE_BYTES ?? 1_000_000;

  app.get("/health", async () => ({ status: "ok" }));
  if (config) {
    registerFileRoutes(app, config);
    registerAgentRoutes(app, config);
  }

  app.post("/api/ingestion/upload", async (request, reply) => {
    try {
      const upload = validateIngestionUpload(request.body, {
        maxFileBytes: ingestionMaxFileBytes
      });
      const result = await ingestionPipeline.ingest(upload.source);

      return {
        file_name: upload.fileName,
        mime_type: upload.source.mimeType,
        size_bytes: upload.sizeBytes,
        document_id: result.documentId,
        job_id: result.jobId,
        chunk_count: result.chunkCount,
        page_count: result.pageCount,
        checksum: result.checksum,
        version: result.version,
        status: result.status,
        embedding_batch_count: result.embeddingBatchCount ?? 0
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(422).send({
          detail: "Invalid upload",
          errors: error.flatten().fieldErrors
        });
      }
      throw error;
    }
  });

  app.post("/api/rag/query", async (request, reply) => {
    const parsedRequest = ragQuerySchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid RAG query",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    const result = await ragPipeline.answerWithCitations({
      tenantId: parsedRequest.data.tenantId,
      ownerUserId: parsedRequest.data.ownerUserId,
      query: parsedRequest.data.query,
      topK: parsedRequest.data.topK,
      similarityThreshold: parsedRequest.data.similarityThreshold,
      metadata: parsedRequest.data.metadata,
      strategy: parsedRequest.data.strategy
    });

    return {
      status: result.status,
      answer: result.answer,
      contexts: result.contexts,
      citations: result.citations
    };
  });

  app.post("/api/rag/evaluate", async (request, reply) => {
    const parsedRequest = ragEvaluationSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid RAG evaluation",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    const cases: RagEvaluationCase[] = parsedRequest.data.cases;
    const result = await evaluateRagPipeline(ragPipeline, cases, {
      tenantId: parsedRequest.data.tenantId,
      ownerUserId: parsedRequest.data.ownerUserId,
      strategy: parsedRequest.data.strategy,
      topK: parsedRequest.data.topK,
      similarityThreshold: parsedRequest.data.similarityThreshold
    });

    return {
      ...result,
      report: buildEvaluationReport(parsedRequest.data.strategy, result)
    };
  });

  app.post("/api/chat", async (request, reply) => {
    const parsedRequest = chatRequestSchema.safeParse(request.body);
    if (!parsedRequest.success) {
      return reply.status(422).send({
        detail: "Invalid request",
        errors: parsedRequest.error.flatten().fieldErrors
      });
    }

    const rateLimitDecision = rateLimiter.consume(parsedRequest.data.userId);
    writeRateLimitHeaders(reply, rateLimitDecision);
    if (!rateLimitDecision.allowed) {
      return reply.status(429).send({
        detail: "Rate limit exceeded",
        retry_after_ms: rateLimitDecision.retryAfterMs
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
      const estimatedCostUsdMicros = result.cacheHit
        ? 0
        : estimateCostUsdMicros(result.usage, pricingCatalog[result.provider]);

      let assistantMessageId: string | undefined;
      if (conversationRepository && conversation) {
        const assistantMessage = await conversationRepository.addMessage({
          conversationId: conversation.id,
          role: "assistant",
          content: result.text,
          model: result.model,
          provider: result.provider,
          usage: result.usage,
          estimatedCostUsdMicros
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
          totalTokens: result.usage.totalTokens,
          estimatedCostUsdMicros,
          cacheHit: result.cacheHit ?? false
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
        estimated_cost_usd: usdMicrosToUsd(estimatedCostUsdMicros),
        cache_hit: result.cacheHit ?? false,
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

    const rateLimitDecision = rateLimiter.consume(parsedRequest.data.userId);
    writeRateLimitHeaders(reply, rateLimitDecision);
    if (!rateLimitDecision.allowed) {
      return reply.status(429).send({
        detail: "Rate limit exceeded",
        retry_after_ms: rateLimitDecision.retryAfterMs
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
      let estimatedCostUsdMicros = 0;

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
          if (providerName) {
            estimatedCostUsdMicros = estimateCostUsdMicros(event.usage, pricingCatalog[providerName]);
          }
          reply.raw.write(
            encodeStreamEvent({
              type: "usage",
              usage: event.usage,
              latencyMs: Math.round(performance.now() - startedAt),
              estimatedCostUsd: usdMicrosToUsd(estimatedCostUsdMicros)
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
            usage,
            estimatedCostUsdMicros
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

  app.get("/api/users/:userId/cost-summary", async (request, reply) => {
    if (!conversationRepository) {
      return reply.status(503).send({ detail: "Cost summary requires conversation persistence" });
    }

    const parsedParams = userParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.status(422).send({
        detail: "Invalid request",
        errors: parsedParams.error.flatten().fieldErrors
      });
    }

    const summary = await conversationRepository.getUserCostSummary(parsedParams.data.userId);
    return {
      user_id: summary.userId,
      request_count: summary.requestCount,
      input_tokens: summary.inputTokens,
      output_tokens: summary.outputTokens,
      thinking_tokens: summary.thinkingTokens,
      total_tokens: summary.totalTokens,
      estimated_cost_usd: usdMicrosToUsd(summary.estimatedCostUsdMicros),
      estimated_cost_usd_micros: summary.estimatedCostUsdMicros
    };
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

function writeRateLimitHeaders(
  reply: { header: (name: string, value: string | number) => unknown },
  decision: RateLimitDecision
) {
  reply.header("RateLimit-Limit", decision.limit);
  reply.header("RateLimit-Remaining", decision.remaining);
  reply.header("RateLimit-Reset", Math.ceil(decision.resetAt / 1000));
  if (!decision.allowed) {
    reply.header("Retry-After", Math.ceil(decision.retryAfterMs / 1000));
  }
}

function buildPricingCatalog(config: AppConfig): ProviderPricingCatalog {
  return {
    fake: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
      thinkingUsdPerMillionTokens: 0
    },
    openai: {
      inputUsdPerMillionTokens: config.OPENAI_INPUT_USD_PER_1M_TOKENS,
      outputUsdPerMillionTokens: config.OPENAI_OUTPUT_USD_PER_1M_TOKENS,
      thinkingUsdPerMillionTokens: config.OPENAI_THINKING_USD_PER_1M_TOKENS
    },
    gemini: {
      inputUsdPerMillionTokens: config.GEMINI_INPUT_USD_PER_1M_TOKENS,
      outputUsdPerMillionTokens: config.GEMINI_OUTPUT_USD_PER_1M_TOKENS,
      thinkingUsdPerMillionTokens: config.GEMINI_THINKING_USD_PER_1M_TOKENS
    }
  };
}

function buildZeroPricingCatalog(): ProviderPricingCatalog {
  return {
    fake: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
      thinkingUsdPerMillionTokens: 0
    },
    openai: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
      thinkingUsdPerMillionTokens: 0
    },
    gemini: {
      inputUsdPerMillionTokens: 0,
      outputUsdPerMillionTokens: 0,
      thinkingUsdPerMillionTokens: 0
    }
  };
}
