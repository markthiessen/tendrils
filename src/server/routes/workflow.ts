import type { FastifyInstance } from "fastify";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../../db/log.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerWorkflowRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { repo?: string } }>("/api/next", (req) => {
    return ctx.withDb((db) => {
      // Prioritize tasks with incomplete items for this repo
      const repoFilter = req.query.repo
        ? `AND t.id IN (SELECT task_id FROM task_items WHERE repo = '${req.query.repo.replace(/'/g, "''")}' AND done = 0)`
        : "";

      let task = db.prepare(
        `SELECT t.* FROM tasks t
         WHERE t.status = 'ready'
         ${repoFilter}
         ORDER BY t.goal_id, t.seq
         LIMIT 1`,
      ).get() as any;

      // Fall back to any ready task if no repo-specific matches
      if (!task && req.query.repo) {
        task = db.prepare(
          `SELECT t.* FROM tasks t
           WHERE t.status = 'ready'
           ORDER BY t.goal_id, t.seq
           LIMIT 1`,
        ).get() as any;
      }

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
