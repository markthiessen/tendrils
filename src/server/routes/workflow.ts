import type { FastifyInstance } from "fastify";
import { insertLogEntry, findLogEntries, findRecentLogEntries } from "../../db/log.js";
import { emit } from "../sse.js";
import type { ServerContext } from "../context.js";

export function registerWorkflowRoutes(app: FastifyInstance, ctx: ServerContext) {
  app.get<{ Querystring: { repo?: string } }>("/api/next", (req) => {
    // Prioritize stories with incomplete items for this repo
    const repoFilter = req.query.repo
      ? `AND s.id IN (SELECT story_id FROM story_items WHERE repo = '${req.query.repo.replace(/'/g, "''")}' AND done = 0)`
      : "";

    let story = ctx.db.prepare(
      `SELECT s.*, t.activity_id FROM stories s
       JOIN tasks t ON s.task_id = t.id
       WHERE s.status = 'ready'
       ${repoFilter}
       ORDER BY t.activity_id, t.seq, s.seq
       LIMIT 1`,
    ).get() as any;

    // Fall back to any ready story if no repo-specific matches
    if (!story && req.query.repo) {
      story = ctx.db.prepare(
        `SELECT s.*, t.activity_id FROM stories s
         JOIN tasks t ON s.task_id = t.id
         WHERE s.status = 'ready'
         ORDER BY t.activity_id, t.seq, s.seq
         LIMIT 1`,
      ).get() as any;
    }

    if (story) return { ok: true, data: { ...story, entityType: "story" } };

    return { ok: true, data: null };
  });

  app.get<{ Params: { entityType: string; entityId: string } }>("/api/log/:entityType/:entityId", (req) => {
    const entries = findLogEntries(ctx.db, "story", Number(req.params.entityId));
    return { ok: true, data: entries };
  });

  app.get<{ Querystring: { limit?: string } }>("/api/log", (req) => {
    const entries = findRecentLogEntries(ctx.db, Number(req.query.limit ?? 20));
    return { ok: true, data: entries };
  });

  app.post<{ Body: { entityType: "story"; entityId: number; message: string; agent?: string } }>("/api/log", (req) => {
    const entry = insertLogEntry(ctx.db, "story", req.body.entityId, req.body.message, req.body.agent);
    emit("log.created", entry);
    return { ok: true, data: entry };
  });
}
