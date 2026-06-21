import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";
import { FileToolError } from "../filesystem/service.js";
import { FileAgentService } from "./file-agent.js";

const chatSchema = z.object({
  message: z.string().min(1).max(20_000)
});

const approveSchema = z.object({
  actionId: z.string().min(1)
});

export function registerAgentRoutes(app: FastifyInstance, config: AppConfig): void {
  const agent = new FileAgentService(config);

  app.post("/api/agent/chat", async (request, reply) =>
    handleAgent(reply, async () => {
      const body = chatSchema.parse(request.body);
      return await agent.chat(body.message);
    })
  );

  app.get("/api/agent/pending", async () => ({
    actions: agent.listPendingActions()
  }));

  app.post("/api/agent/approve", async (request, reply) =>
    handleAgent(reply, async () => {
      const body = approveSchema.parse(request.body);
      return await agent.approve(body.actionId);
    })
  );
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
