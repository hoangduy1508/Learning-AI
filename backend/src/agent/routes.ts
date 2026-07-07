import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";
import { FileToolError } from "../filesystem/service.js";
import { FileAgentService, type ContentGenerator } from "./file-agent.js";

const chatSchema = z.object({
  message: z.string().min(1).max(20_000)
});

const approveSchema = z.object({
  actionId: z.string().min(1)
});

export function registerAgentRoutes(app: FastifyInstance, config: AppConfig): void {
  const agent =
    config.GEMINI_API_KEY && config.LLM_PROVIDER === "gemini"
      ? new FileAgentService(config)
      : new FileAgentService(config, createFakeAgentClient());

  app.post("/api/agent/chat", async (request, reply) =>
    handleAgent(reply, async () => {
      const body = chatSchema.parse(request.body);
      return await agent.chat(body.message);
    })
  );

  app.get("/api/agent/pending", async () => ({
    actions: agent.listPendingActions()
  }));

  app.get("/api/agent/audit", async () => ({
    entries: agent.listAuditLog()
  }));

  app.post("/api/agent/approve", async (request, reply) =>
    handleAgent(reply, async () => {
      const body = approveSchema.parse(request.body);
      return await agent.approve(body.actionId);
    })
  );
}

function createFakeAgentClient(): ContentGenerator {
  return {
    models: {
      async generateContent(request) {
        const requestObject = request as {
          contents?: Array<{ parts?: Array<Record<string, unknown>> }> | string;
        };
        const contents = Array.isArray(requestObject.contents) ? requestObject.contents : [];
        const hasToolResponse = contents.some((content) =>
          content.parts?.some((part) => "functionResponse" in part)
        );
        if (hasToolResponse) {
          return {
            text: "Đã hoàn tất tool call bằng fake planner.",
            functionCalls: []
          };
        }

        const message =
          contents
            .flatMap((content) =>
              typeof content === "object" && "parts" in content ? (content.parts ?? []) : []
            )
            .map((part) => (typeof part.text === "string" ? part.text : ""))
            .join("\n")
            .toLowerCase() ?? "";

        if (message.includes("thời tiết") || message.includes("weather")) {
          return {
            functionCalls: [
              {
                name: "get_weather",
                args: {
                  location: message.includes("ho chi minh") ? "Ho Chi Minh City" : "Hanoi",
                  unit: "celsius"
                }
              }
            ]
          };
        }

        if (message.includes("order") || message.includes("đơn hàng")) {
          return {
            functionCalls: [
              {
                name: "get_order_status",
                args: { orderId: "ord_1001" }
              }
            ]
          };
        }

        if (message.includes("ticket")) {
          return {
            functionCalls: [
              {
                name: "create_support_ticket",
                args: {
                  title: "Demo support ticket",
                  category: "technical",
                  priority: "medium",
                  customerEmail: null,
                  summary: "Ticket được tạo từ fake planner để kiểm thử human approval.",
                  idempotencyKey: "demo_support_ticket"
                }
              }
            ]
          };
        }

        if (message.includes("ghi") || message.includes("write") || message.includes("tạo file")) {
          return {
            functionCalls: [
              {
                name: "write_file",
                args: {
                  path: "notes/project-1-ui.txt",
                  content: "hello from project 1 ui",
                  createDirs: true
                }
              }
            ]
          };
        }

        return {
          text: "Fake planner không cần gọi tool cho yêu cầu này.",
          functionCalls: []
        };
      }
    }
  };
}

async function handleAgent(reply: FastifyReply, action: () => Promise<unknown>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return reply.status(422).send({ detail: "Invalid request", errors: error.flatten() });
    }
    if (error instanceof FileToolError) {
      return reply.status(error.statusCode).send({ detail: error.message });
    }
    throw error;
  }
}
