import type { FastifyInstance } from "fastify";
import { findNextTask } from "../../db/task.js";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../../db/log.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerWorkflowRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { repo?: string } }>("/api/next", (req) => {
    return ctx.withDb((db) => {
      const task = findNextTask(db, req.query.repo);
      if (task) return { ok: true, data: { ...task, entityType: "task" } };
      return { ok: true, data: null };
    });
  });

  app.get<{ Params: { entityType: string; entityId: string } }>("/api/log/:entityType/:entityId", (req) => {
    return ctx.withDb((db) => {
      const entries = findLogEntries(db, "task", Number(req.params.entityId));
      return { ok: true, data: entries };
    });
  });

  app.get<{ Querystring: { limit?: string } }>("/api/log", (req) => {
    return ctx.withDb((db) => {
      const entries = findRecentLogEntries(db, Number(req.query.limit ?? 20));
      return { ok: true, data: entries };
    });
  });

  app.post<{ Body: { entityType: "task"; entityId: number; message: string; agent?: string } }>("/api/log", (req) => {
    return ctx.withDb((db) => {
      const entry = insertLogEntry(db, "task", req.body.entityId, req.body.message, req.body.agent);
      emit("log.created", entry);
      return { ok: true, data: entry };
    });
  });
}
