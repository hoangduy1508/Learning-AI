import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";

import type { AppConfig } from "../config.js";
import {
  FileSystemToolService,
  FileToolError,
  parseAllowedRoots
} from "./service.js";

const rootSchema = z.object({
  root: z.string().optional()
});

const listSchema = rootSchema.extend({
  path: z.string().default(".")
});

const readSchema = rootSchema.extend({
  path: z.string().min(1)
});

const searchSchema = rootSchema.extend({
  path: z.string().default("."),
  query: z.string().min(1),
  limit: z.number().int().positive().max(200).default(50)
});

const writeSchema = rootSchema.extend({
  path: z.string().min(1),
  content: z.string(),
  createDirs: z.boolean().default(false)
});

const deleteSchema = rootSchema.extend({
  path: z.string().min(1),
  recursive: z.boolean().default(false),
  confirmation: z.string().optional()
});

export function registerFileRoutes(app: FastifyInstance, config: AppConfig): void {
  const service = new FileSystemToolService({
    allowedRoots: parseAllowedRoots(config.FILE_TOOL_ALLOWED_ROOTS),
    allowWrite: config.FILE_TOOL_ALLOW_WRITE,
    allowDelete: config.FILE_TOOL_ALLOW_DELETE,
    maxFileBytes: config.FILE_TOOL_MAX_FILE_BYTES
  });

  app.get("/api/files/roots", async () => ({
    roots: service.listRoots(),
    writeEnabled: config.FILE_TOOL_ALLOW_WRITE,
    deleteEnabled: config.FILE_TOOL_ALLOW_DELETE
  }));

  app.post("/api/files/list", async (request, reply) =>
    handleFileTool(reply, async () => {
      const body = listSchema.parse(request.body);
      request.log.info({ body }, "File list requested");
      return { entries: await service.list(body.root, body.path) };
    })
  );

  app.post("/api/files/read", async (request, reply) =>
    handleFileTool(reply, async () => {
      const body = readSchema.parse(request.body);
      request.log.info({ path: body.path, root: body.root }, "File read requested");
      return await service.read(body.root, body.path);
    })
  );

  app.post("/api/files/search", async (request, reply) =>
    handleFileTool(reply, async () => {
      const body = searchSchema.parse(request.body);
      request.log.info(
        { path: body.path, root: body.root, query: body.query, limit: body.limit },
        "File search requested"
      );
      return { matches: await service.search(body.root, body.query, body) };
    })
  );

  app.post("/api/files/write", async (request, reply) =>
    handleFileTool(reply, async () => {
      const body = writeSchema.parse(request.body);
      request.log.warn({ path: body.path, root: body.root }, "File write requested");
      return await service.write(body.root, body.path, body.content, body);
    })
  );

  app.post("/api/files/delete", async (request, reply) =>
    handleFileTool(reply, async () => {
      const body = deleteSchema.parse(request.body);
      request.log.warn(
        { path: body.path, root: body.root, recursive: body.recursive },
        "File delete requested"
      );
      return await service.delete(body.root, body.path, body);
    })
  );
}

async function handleFileTool(reply: FastifyReply, action: () => Promise<unknown>) {
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
